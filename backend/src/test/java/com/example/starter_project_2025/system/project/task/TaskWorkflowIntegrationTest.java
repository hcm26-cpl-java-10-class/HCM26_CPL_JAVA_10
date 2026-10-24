package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditRepository;
import com.example.starter_project_2025.system.project.task.dependency.TaskDependencyRepository;
import com.example.starter_project_2025.system.project.task.dependency.TaskDependencyRequest;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxRepository;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxService;
import com.example.starter_project_2025.system.project.task.workflow.TaskStatusRequest;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.boot.test.mock.mockito.SpyBean;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task_workflow;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "app.sprint.outbox.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
class TaskWorkflowIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired TaskRepository taskRepository;
    @Autowired TaskDependencyRepository dependencyRepository;
    @Autowired TaskAuditRepository auditRepository;
    @Autowired TaskOutboxRepository outboxRepository;
    @Autowired UserRepository userRepository;
    @Autowired UserDetailsService userDetailsService;
    @Autowired RefreshTokenService tokenService;
    @MockBean TaskProjectAccess projectAccess;
    @SpyBean TaskOutboxService outboxService;

    private UUID projectId;
    private UUID otherProjectId;
    private UUID assigneeId;
    private Long studentId;
    private Long teacherId;
    private String studentToken;
    private String teacherToken;
    private TaskOutboxService outboxSpy;

    @BeforeEach
    void setUp() {
        dependencyRepository.deleteAll();
        taskRepository.deleteAll();
        auditRepository.deleteAll();
        outboxRepository.deleteAll();
        projectId = UUID.randomUUID();
        otherProjectId = UUID.randomUUID();
        assigneeId = UUID.randomUUID();
        studentId = userRepository.findByEmail("student@example.com").orElseThrow().getId();
        teacherId = userRepository.findByEmail("teacher@example.com").orElseThrow().getId();
        studentToken = token("student@example.com");
        teacherToken = token("teacher@example.com");
        outboxSpy = AopTestUtils.getUltimateTargetObject(outboxService);
        when(projectAccess.findProjectIds(anyLong())).thenReturn(Set.of(projectId, otherProjectId));
        when(projectAccess.findMemberUserId(any(), any())).thenReturn(Optional.empty());
        when(projectAccess.findMemberUserId(projectId, assigneeId)).thenReturn(Optional.of(studentId));
    }

    @Test
    void workflowFollowsEveryStepAndBlockedBranchWithAuditAndActivity() throws Exception {
        Task task = task("Task A", TaskStatus.TODO);
        Long version = task.getVersion();
        for (TaskStatus next : List.of(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED,
                TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.DONE)) {
            TaskDTO changed = body(changeStatus(task.getId(), version, next, studentToken, UUID.randomUUID())
                    .andExpect(status().isOk()).andExpect(jsonPath("$.status").value(next.name())));
            assertTrue(changed.getVersion() > version);
            version = changed.getVersion();
        }
        assertEquals(5, auditRepository.count());
        assertEquals(5, outboxRepository.count());
        var audit = auditRepository.findByTaskIdOrderByOccurredAtAsc(task.getId()).getLast();
        assertEquals("STATUS_CHANGED", audit.getAction());
        assertEquals(studentId, audit.getActorId());
        assertEquals("workflow-test", audit.getCorrelationId());
        assertEquals("REVIEW", objectMapper.readTree(audit.getBeforeState()).get("status").asText());
        assertEquals("DONE", objectMapper.readTree(audit.getAfterState()).get("status").asText());
        mockMvc.perform(get("/api/tasks/{id}/workflow", task.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.allowedTransitions").isEmpty())
                .andExpect(jsonPath("$.editable").value(true));
        mockMvc.perform(get("/api/tasks/{id}/activity", task.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[4].after.status").value("DONE"))
                .andExpect(jsonPath("$[4].actorName", not(emptyString())));
    }

    @Test
    void rejectedReviewReturnsToInProgressAndCanBeSubmittedAgain() throws Exception {
        Task prerequisite = task("Tiền đề đã xong", TaskStatus.DONE);
        Task task = task("Task cần chỉnh sửa", TaskStatus.TODO);
        TaskDTO linked = link(prerequisite, task);
        TaskDTO started = move(task.getId(), linked.getVersion(), TaskStatus.IN_PROGRESS);
        TaskDTO review = move(task.getId(), started.getVersion(), TaskStatus.REVIEW);
        mockMvc.perform(get("/api/tasks/{id}/workflow", task.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.allowedTransitions", containsInAnyOrder("DONE", "IN_PROGRESS")));

        UUID returnKey = UUID.randomUUID();
        TaskDTO returned = body(changeStatus(task.getId(), review.getVersion(), TaskStatus.IN_PROGRESS,
                studentToken, returnKey).andExpect(status().isOk()));
        assertEquals(TaskStatus.IN_PROGRESS, returned.getStatus());
        assertTrue(returned.getVersion() > review.getVersion());
        assertEquals(linked.getPredecessorTaskIds(), returned.getPredecessorTaskIds());
        TaskDTO replay = body(changeStatus(task.getId(), review.getVersion(), TaskStatus.IN_PROGRESS,
                studentToken, returnKey).andExpect(status().isOk()));
        assertEquals(returned.getVersion(), replay.getVersion());
        assertEquals(4, auditRepository.count());
        assertEquals(4, outboxRepository.count());

        var returnAudit = auditRepository.findByTaskIdOrderByOccurredAtAsc(task.getId()).getLast();
        assertEquals("STATUS_CHANGED", returnAudit.getAction());
        assertEquals(studentId, returnAudit.getActorId());
        assertEquals("REVIEW", objectMapper.readTree(returnAudit.getBeforeState()).get("status").asText());
        assertEquals("IN_PROGRESS", objectMapper.readTree(returnAudit.getAfterState()).get("status").asText());
        assertEquals("TASK_STATUS_CHANGED", outboxRepository.findByActorIdAndRequestId(studentId, returnKey)
                .orElseThrow().getEventType());

        changeStatus(task.getId(), review.getVersion(), TaskStatus.DONE, studentToken, UUID.randomUUID())
                .andExpect(status().isConflict());
        changeStatus(task.getId(), returned.getVersion(), TaskStatus.DONE, studentToken, UUID.randomUUID())
                .andExpect(status().isConflict());
        TaskDTO reviewedAgain = move(task.getId(), returned.getVersion(), TaskStatus.REVIEW);
        move(task.getId(), reviewedAgain.getVersion(), TaskStatus.DONE);
        assertEquals(6, auditRepository.count());
        assertEquals(6, outboxRepository.count());
    }

    @Test
    void unfinishedDependencyBlocksStartingUntilItsPredecessorIsDone() throws Exception {
        Task predecessor = task("Tiền đề", TaskStatus.TODO);
        Task successor = task("Công việc phụ thuộc", TaskStatus.TODO);
        TaskDTO linked = body(add(successor.getId(), successor.getVersion(), predecessor.getId(), studentToken, UUID.randomUUID())
                .andExpect(status().isOk()).andExpect(jsonPath("$.predecessorTaskIds[0]").value(predecessor.getId().toString())));
        Long version = predecessor.getVersion();
        for (TaskStatus next : List.of(TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED,
                TaskStatus.IN_PROGRESS, TaskStatus.REVIEW)) {
            expectStartBlocked(linked.getId(), linked.getVersion());
            version = move(predecessor.getId(), version, next).getVersion();
        }
        expectStartBlocked(linked.getId(), linked.getVersion());
        assertEquals(5, auditRepository.count());
        assertEquals(5, outboxRepository.count());
        move(predecessor.getId(), version, TaskStatus.DONE);
        assertEquals(TaskStatus.TODO, stored(successor.getId()).getStatus());
        assertEquals(linked.getVersion(), stored(successor.getId()).getVersion());
        finish(successor.getId());
        assertEquals(TaskStatus.DONE, stored(successor.getId()).getStatus());
        assertEquals(9, auditRepository.count());
        assertEquals(9, outboxRepository.count());
        mockMvc.perform(get("/api/tasks/{id}/workflow", successor.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.predecessors[0].title").value("Tiền đề"))
                .andExpect(jsonPath("$.predecessors[0].status").value("DONE"));
    }

    @Test
    void sharedPrerequisitesAndDiamondBranchesRequireEveryPredecessorToFinish() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        Task d = task("D", TaskStatus.TODO);
        Task e = task("E", TaskStatus.TODO);
        link(a, b);
        link(a, c);
        link(b, d);
        TaskDTO linkedD = link(c, d);
        link(a, e);
        TaskDTO linkedE = link(d, e);

        mockMvc.perform(get("/api/tasks/{id}/workflow", a.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.predecessors").isEmpty())
                .andExpect(jsonPath("$.successors[*].taskId", containsInAnyOrder(
                        b.getId().toString(), c.getId().toString(), e.getId().toString())));
        mockMvc.perform(get("/api/tasks/{id}/workflow", d.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.predecessors[*].taskId", containsInAnyOrder(
                        b.getId().toString(), c.getId().toString())))
                .andExpect(jsonPath("$.successors[0].taskId").value(e.getId().toString()));

        expectStartBlocked(b.getId(), stored(b.getId()).getVersion());
        expectStartBlocked(c.getId(), stored(c.getId()).getVersion());
        finish(a.getId());
        expectStartBlocked(d.getId(), linkedD.getVersion());
        finish(b.getId());
        expectStartBlocked(d.getId(), linkedD.getVersion());
        expectStartBlocked(e.getId(), linkedE.getVersion());
        finish(c.getId());
        finish(d.getId());
        move(e.getId(), linkedE.getVersion(), TaskStatus.IN_PROGRESS);
        assertEquals(6, dependencyRepository.count());
        assertEquals(19, auditRepository.count());
        assertEquals(19, outboxRepository.count());
    }

    @Test
    void cyclesAcrossSharedBranchesAndMultipleLevelsAreRejected() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        Task d = task("D", TaskStatus.TODO);
        Task e = task("E", TaskStatus.TODO);
        link(a, b);
        link(a, c);
        link(b, d);
        link(c, d);
        link(d, e);
        link(a, e);
        link(b, c);
        for (Task predecessor : List.of(c, d, e)) {
            add(a.getId(), stored(a.getId()).getVersion(), predecessor.getId(), studentToken, UUID.randomUUID())
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.errors.predecessorTaskId", hasItem("Không thể tạo phụ thuộc vòng (Circular Dependency)")));
        }
        add(b.getId(), stored(b.getId()).getVersion(), e.getId(), studentToken, UUID.randomUUID())
                .andExpect(status().isUnprocessableEntity());
        add(b.getId(), stored(b.getId()).getVersion(), c.getId(), studentToken, UUID.randomUUID())
                .andExpect(status().isUnprocessableEntity());
        assertEquals(7, dependencyRepository.count());
        assertEquals(7, auditRepository.count());
        assertEquals(7, outboxRepository.count());
        assertEquals(a.getVersion(), stored(a.getId()).getVersion());
    }

    @Test
    void removingOnlyOneUnfinishedPrerequisiteDoesNotUnlockTheTask() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        Task done = task("Done", TaskStatus.DONE);
        link(a, b);
        link(c, b);
        TaskDTO linked = link(done, b);
        expectStartBlocked(b.getId(), linked.getVersion());
        TaskDTO removedA = body(remove(b.getId(), linked.getVersion(), a.getId(), UUID.randomUUID())
                .andExpect(status().isOk()));
        expectStartBlocked(b.getId(), removedA.getVersion());
        TaskDTO removedC = body(remove(b.getId(), removedA.getVersion(), c.getId(), UUID.randomUUID())
                .andExpect(status().isOk()));
        assertEquals(List.of(done.getId()), removedC.getPredecessorTaskIds());
        move(b.getId(), removedC.getVersion(), TaskStatus.IN_PROGRESS);
        assertEquals(TaskStatus.TODO, stored(a.getId()).getStatus());
        assertEquals(TaskStatus.TODO, stored(c.getId()).getStatus());
        assertEquals(1, dependencyRepository.count());
        assertEquals(6, auditRepository.count());
        assertEquals(6, outboxRepository.count());
    }

    @Test
    void selfDirectAndIndirectCyclesAreRejectedWithoutChangingGraph() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isOk());
        add(c.getId(), c.getVersion(), b.getId(), studentToken, UUID.randomUUID()).andExpect(status().isOk());
        for (UUID predecessorId : List.of(a.getId(), b.getId(), c.getId())) {
            add(a.getId(), a.getVersion(), predecessorId, studentToken, UUID.randomUUID())
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.errors.predecessorTaskId", hasItem("Không thể tạo phụ thuộc vòng (Circular Dependency)")));
        }
        assertEquals(2, dependencyRepository.count());
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
        assertEquals(a.getVersion(), stored(a.getId()).getVersion());
    }

    @Test
    void crossProjectAndDuplicateDependenciesAreRejected() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task outside = taskRepository.saveAndFlush(Task.builder().projectId(otherProjectId)
                .title("Other project").createdBy(studentId).updatedBy(studentId).build());
        add(b.getId(), b.getVersion(), outside.getId(), studentToken, UUID.randomUUID())
                .andExpect(status().isUnprocessableEntity());
        TaskDTO linked = body(add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isOk()));
        add(b.getId(), linked.getVersion(), a.getId(), studentToken, UUID.randomUUID())
                .andExpect(status().isConflict());
        assertEquals(1, dependencyRepository.count());
        assertEquals(1, auditRepository.count());
    }

    @Test
    void missingOrInactiveTasksAndMissingLinksReturn404() throws Exception {
        Task a = task("A", TaskStatus.DONE);
        Task b = task("B", TaskStatus.REVIEW);
        add(b.getId(), b.getVersion(), UUID.randomUUID(), studentToken, UUID.randomUUID())
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.message").value("Task liên kết không tồn tại hoặc đã bị xóa"));
        remove(b.getId(), b.getVersion(), a.getId(), UUID.randomUUID()).andExpect(status().isNotFound());
        TaskDTO linked = body(add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isOk()));
        a.setIsActive(false);
        taskRepository.saveAndFlush(a);
        changeStatus(b.getId(), linked.getVersion(), TaskStatus.DONE, studentToken, UUID.randomUUID())
                .andExpect(status().isNotFound());
        add(b.getId(), linked.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isNotFound());
        assertEquals(TaskStatus.REVIEW, stored(b.getId()).getStatus());
        assertEquals(1, auditRepository.count());
    }

    @Test
    void skippedWorkflowStepsMissingValuesAndStaleVersionsDoNotWrite() throws Exception {
        Task task = task("A", TaskStatus.TODO);
        changeStatus(task.getId(), task.getVersion(), TaskStatus.DONE, studentToken, UUID.randomUUID()).andExpect(status().isConflict());
        changeStatus(task.getId(), task.getVersion(), TaskStatus.BLOCKED, studentToken, UUID.randomUUID()).andExpect(status().isConflict());
        changeStatus(task.getId(), null, TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID()).andExpect(status().isUnprocessableEntity());
        changeStatus(task.getId(), task.getVersion(), null, studentToken, UUID.randomUUID()).andExpect(status().isUnprocessableEntity());
        move(task.getId(), task.getVersion(), TaskStatus.IN_PROGRESS);
        changeStatus(task.getId(), task.getVersion(), TaskStatus.REVIEW, studentToken, UUID.randomUUID()).andExpect(status().isConflict());
        mockMvc.perform(patch("/api/tasks/{id}/status", task.getId()).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"status\":\"UNKNOWN\",\"version\":1}"))
                .andExpect(status().isUnprocessableEntity());
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void assigneeAndManagerPermissionsRemainBoundToProjectScope() throws Exception {
        Task task = task("A", TaskStatus.TODO);
        changeStatus(task.getId(), task.getVersion(), TaskStatus.IN_PROGRESS, teacherToken, UUID.randomUUID()).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/tasks/{id}/workflow", task.getId()).header("Authorization", teacherToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.editable").value(false));
        when(projectAccess.isManager(projectId, teacherId)).thenReturn(true);
        changeStatus(task.getId(), task.getVersion(), TaskStatus.IN_PROGRESS, teacherToken, UUID.randomUUID()).andExpect(status().isOk());
        Task assigned = taskRepository.saveAndFlush(Task.builder().projectId(projectId).title("Assigned")
                .createdBy(teacherId).updatedBy(teacherId).assigneeProjectMemberId(assigneeId).estimatedHours(2.0).build());
        move(assigned.getId(), assigned.getVersion(), TaskStatus.IN_PROGRESS);

        when(projectAccess.findProjectIds(teacherId)).thenReturn(Set.of(otherProjectId));
        mockMvc.perform(get("/api/tasks/{id}/workflow", task.getId()).header("Authorization", teacherToken))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.task").doesNotExist());
        mockMvc.perform(get("/api/tasks/{id}/activity", task.getId()).header("Authorization", teacherToken))
                .andExpect(status().isForbidden());
        changeStatus(task.getId(), stored(task.getId()).getVersion(), TaskStatus.REVIEW, teacherToken, UUID.randomUUID())
                .andExpect(status().isForbidden());
        add(task.getId(), stored(task.getId()).getVersion(), assigned.getId(), teacherToken, UUID.randomUUID())
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/tasks/{id}/workflow", task.getId())).andExpect(status().isUnauthorized());
    }

    @Test
    void idempotentStatusReplayReturnsOriginalResultWithoutAnotherEvent() throws Exception {
        Task task = task("A", TaskStatus.TODO);
        UUID key = UUID.randomUUID();
        TaskDTO first = body(changeStatus(task.getId(), task.getVersion(), TaskStatus.IN_PROGRESS, studentToken, key).andExpect(status().isOk()));
        TaskDTO replay = body(changeStatus(task.getId(), task.getVersion(), TaskStatus.IN_PROGRESS, studentToken, key).andExpect(status().isOk()));
        assertEquals(first.getVersion(), replay.getVersion());
        changeStatus(task.getId(), first.getVersion(), TaskStatus.REVIEW, studentToken, key).andExpect(status().isConflict());
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
        assertEquals("TASK_STATUS_CHANGED", outboxRepository.findByActorIdAndRequestId(studentId, key).orElseThrow().getEventType());
    }

    @Test
    void addAndRemoveReplayTheirOriginalDependencySnapshots() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        UUID addKey = UUID.randomUUID();
        UUID removeKey = UUID.randomUUID();
        TaskDTO linked = body(add(b.getId(), b.getVersion(), a.getId(), studentToken, addKey).andExpect(status().isOk()));
        add(b.getId(), b.getVersion(), a.getId(), studentToken, addKey).andExpect(status().isOk());
        TaskDTO removed = body(remove(b.getId(), linked.getVersion(), a.getId(), removeKey).andExpect(status().isOk()));
        remove(b.getId(), linked.getVersion(), a.getId(), removeKey).andExpect(status().isOk());
        TaskDTO oldReplay = body(add(b.getId(), b.getVersion(), a.getId(), studentToken, addKey).andExpect(status().isOk()));
        assertEquals(linked.getVersion(), oldReplay.getVersion());
        assertEquals(List.of(a.getId()), oldReplay.getPredecessorTaskIds());
        assertTrue(removed.getPredecessorTaskIds().isEmpty());
        assertEquals(0, dependencyRepository.count());
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
        var audit = auditRepository.findByTaskIdOrderByOccurredAtAsc(b.getId()).getLast();
        assertEquals(1, objectMapper.readTree(audit.getBeforeState()).get("predecessorTaskIds").size());
        assertEquals(0, objectMapper.readTree(audit.getAfterState()).get("predecessorTaskIds").size());
    }

    @Test
    void dependencyChangeInvalidatesOldDetailAndWorkflowVersions() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isOk());
        assertTrue(stored(b.getId()).getVersion() > b.getVersion());
        TaskDTO detail = TaskDTO.builder().projectId(projectId).title("Old form").version(b.getVersion()).build();
        mockMvc.perform(put("/api/tasks/{id}", b.getId()).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(json(detail))).andExpect(status().isConflict());
        changeStatus(b.getId(), b.getVersion(), TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID()).andExpect(status().isConflict());
        remove(b.getId(), b.getVersion(), a.getId(), UUID.randomUUID()).andExpect(status().isConflict());
        assertEquals(1, auditRepository.count());
    }

    @Test
    void startedTasksCannotGainUnfinishedPrerequisitesButCanShareFinishedOnes() throws Exception {
        Task unfinished = task("Unfinished", TaskStatus.TODO);
        Task finished = task("Finished", TaskStatus.DONE);
        for (TaskStatus current : List.of(TaskStatus.IN_PROGRESS, TaskStatus.REVIEW, TaskStatus.BLOCKED, TaskStatus.DONE)) {
            Task started = task(current.name(), current);
            add(started.getId(), started.getVersion(), unfinished.getId(), studentToken, UUID.randomUUID())
                    .andExpect(status().isUnprocessableEntity())
                    .andExpect(jsonPath("$.errors.predecessorTaskId",
                            hasItem("Task đã bắt đầu, chỉ được thêm Task tiền đề đã hoàn thành")));
            assertEquals(started.getVersion(), stored(started.getId()).getVersion());
            add(started.getId(), started.getVersion(), finished.getId(), studentToken, UUID.randomUUID())
                    .andExpect(status().isOk());
        }
        assertEquals(4, dependencyRepository.count());
        assertEquals(4, auditRepository.count());
        assertEquals(4, outboxRepository.count());
    }

    @Test
    void unfinishedDependenciesFromOlderDataStillBlockResumingAndFinishing() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        link(a, b);
        for (TaskStatus current : List.of(TaskStatus.BLOCKED, TaskStatus.REVIEW)) {
            Task legacy = stored(b.getId());
            legacy.setStatus(current);
            legacy = taskRepository.saveAndFlush(legacy);
            List<TaskStatus> nextStatuses = current == TaskStatus.BLOCKED
                    ? List.of(TaskStatus.IN_PROGRESS) : List.of(TaskStatus.IN_PROGRESS, TaskStatus.DONE);
            for (TaskStatus next : nextStatuses) {
                changeStatus(b.getId(), legacy.getVersion(), next, studentToken, UUID.randomUUID())
                        .andExpect(status().isUnprocessableEntity());
            }
            assertEquals(current, stored(b.getId()).getStatus());
            assertEquals(legacy.getVersion(), stored(b.getId()).getVersion());
        }
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void outboxFailureRollsBackDependencyStatusVersionAndAudit() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        doThrow(new IllegalStateException("Simulated outbox failure")).when(outboxSpy)
                .enqueue(anyString(), any(), anyLong(), any(), anyString());
        add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andExpect(status().isInternalServerError());
        changeStatus(b.getId(), b.getVersion(), TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID()).andExpect(status().isInternalServerError());
        assertEquals(0, dependencyRepository.count());
        assertEquals(TaskStatus.TODO, stored(b.getId()).getStatus());
        assertEquals(b.getVersion(), stored(b.getId()).getVersion());
        assertEquals(0, auditRepository.count());
        assertEquals(0, outboxRepository.count());
    }

    @Test
    void concurrentOppositeDependenciesCannotCreateACycle() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        synchronizeRequests();
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> add(a.getId(), a.getVersion(), b.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(value -> value == 200).count());
            assertEquals(1, statuses.stream().filter(value -> value == 422).count());
        }
        assertEquals(1, dependencyRepository.count());
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void concurrentStartAndDependencyAdditionCannotSkipAnUnfinishedPrerequisite() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        synchronizeRequests();
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> changeStatus(b.getId(), b.getVersion(), TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(value -> value == 200).count());
            assertEquals(1, statuses.stream().filter(value -> value == 409).count());
        }
        if (stored(b.getId()).getStatus() == TaskStatus.IN_PROGRESS) {
            assertEquals(0, dependencyRepository.count());
        } else {
            assertEquals(TaskStatus.TODO, stored(b.getId()).getStatus());
            assertEquals(1, dependencyRepository.count());
        }
        assertEquals(1, auditRepository.count());
        assertEquals(1, outboxRepository.count());
    }

    @Test
    void concurrentEdgesAcrossExistingChainsCannotCloseAMultiLevelCycle() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        Task d = task("D", TaskStatus.TODO);
        link(a, b);
        link(c, d);
        synchronizeRequests(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> add(c.getId(), c.getVersion(), b.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> add(a.getId(), a.getVersion(), d.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(value -> value == 200).count());
            assertEquals(1, statuses.stream().filter(value -> value == 422).count());
        }
        assertEquals(3, dependencyRepository.count());
        assertEquals(3, auditRepository.count());
        assertEquals(3, outboxRepository.count());
    }

    @Test
    void concurrentThreeWayDependenciesCannotCreateACycle() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        synchronizeRequests(3);
        try (var pool = Executors.newFixedThreadPool(3)) {
            var first = pool.submit(() -> add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> add(c.getId(), c.getVersion(), b.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var third = pool.submit(() -> add(a.getId(), a.getVersion(), c.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS), third.get(30, TimeUnit.SECONDS));
            assertEquals(2, statuses.stream().filter(value -> value == 200).count());
            assertEquals(1, statuses.stream().filter(value -> value == 422).count());
        }
        assertEquals(2, dependencyRepository.count());
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
    }

    @Test
    void concurrentPrerequisitesForTheSameTaskRequireAFreshVersion() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        synchronizeRequests(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> add(b.getId(), b.getVersion(), a.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> add(b.getId(), b.getVersion(), c.getId(), studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            List<Integer> statuses = List.of(first.get(30, TimeUnit.SECONDS), second.get(30, TimeUnit.SECONDS));
            assertEquals(1, statuses.stream().filter(value -> value == 200).count());
            assertEquals(1, statuses.stream().filter(value -> value == 409).count());
        }
        doCallRealMethod().when(outboxSpy).findReplay(anyLong(), any(), anyString());
        UUID existing = dependencyRepository.findBySuccessorTaskIdOrderByCreatedAtAsc(b.getId())
                .getFirst().getId().getPredecessorTaskId();
        Task missing = existing.equals(a.getId()) ? c : a;
        TaskDTO linked = link(missing, b);
        expectStartBlocked(b.getId(), linked.getVersion());
        assertEquals(2, dependencyRepository.count());
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
    }

    @Test
    void concurrentPrerequisiteCompletionAndStartRemainConsistent() throws Exception {
        Task a = task("A", TaskStatus.REVIEW);
        Task b = task("B", TaskStatus.TODO);
        TaskDTO linked = link(a, b);
        UUID predecessorId = a.getId();
        Long predecessorVersion = a.getVersion();
        synchronizeRequests(2);
        int startStatus;
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> changeStatus(predecessorId, predecessorVersion, TaskStatus.DONE, studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            var second = pool.submit(() -> changeStatus(b.getId(), linked.getVersion(), TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID()).andReturn().getResponse().getStatus());
            assertEquals(200, first.get(30, TimeUnit.SECONDS));
            startStatus = second.get(30, TimeUnit.SECONDS);
        }
        doCallRealMethod().when(outboxSpy).findReplay(anyLong(), any(), anyString());
        assertEquals(TaskStatus.DONE, stored(predecessorId).getStatus());
        assertTrue(startStatus == 200 || startStatus == 422);
        if (startStatus == 422) {
            assertEquals(TaskStatus.TODO, stored(b.getId()).getStatus());
            assertEquals(linked.getVersion(), stored(b.getId()).getVersion());
            move(b.getId(), linked.getVersion(), TaskStatus.IN_PROGRESS);
        }
        assertEquals(TaskStatus.IN_PROGRESS, stored(b.getId()).getStatus());
        assertEquals(3, auditRepository.count());
        assertEquals(3, outboxRepository.count());
    }

    @Test
    void dependencyPickerCanExcludeCurrentAndAlreadyLinkedTasks() throws Exception {
        Task a = task("A", TaskStatus.TODO);
        Task b = task("B", TaskStatus.TODO);
        Task c = task("C", TaskStatus.TODO);
        mockMvc.perform(get("/api/tasks").header("Authorization", studentToken).param("projectId", projectId.toString())
                        .param("excludeIds", a.getId().toString(), b.getId().toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].id").value(c.getId().toString()));
    }

    private Task task(String title, TaskStatus status) {
        return taskRepository.saveAndFlush(Task.builder().projectId(projectId).title(title).status(status)
                .createdBy(studentId).updatedBy(studentId).build());
    }

    private Task stored(UUID id) {
        return taskRepository.findById(id).orElseThrow();
    }

    private TaskDTO move(UUID id, Long version, TaskStatus next) throws Exception {
        return body(changeStatus(id, version, next, studentToken, UUID.randomUUID()).andExpect(status().isOk()));
    }

    private TaskDTO link(Task predecessor, Task successor) throws Exception {
        return body(add(successor.getId(), stored(successor.getId()).getVersion(), predecessor.getId(),
                studentToken, UUID.randomUUID()).andExpect(status().isOk()));
    }

    private void finish(UUID id) throws Exception {
        TaskDTO started = move(id, stored(id).getVersion(), TaskStatus.IN_PROGRESS);
        TaskDTO review = move(id, started.getVersion(), TaskStatus.REVIEW);
        move(id, review.getVersion(), TaskStatus.DONE);
    }

    private void expectStartBlocked(UUID id, Long version) throws Exception {
        changeStatus(id, version, TaskStatus.IN_PROGRESS, studentToken, UUID.randomUUID())
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errors.status", hasItem("Task tiền đề chưa hoàn thành, không thể chuyển trạng thái")));
        assertEquals(TaskStatus.TODO, stored(id).getStatus());
        assertEquals(version, stored(id).getVersion());
    }

    private ResultActions changeStatus(UUID id, Long version, TaskStatus next, String token, UUID key) throws Exception {
        return mockMvc.perform(patch("/api/tasks/{id}/status", id).header("Authorization", token)
                .header("Idempotency-Key", key).header("X-Correlation-ID", "workflow-test")
                .contentType(MediaType.APPLICATION_JSON).content(json(new TaskStatusRequest(next, version))));
    }

    private ResultActions add(UUID id, Long version, UUID predecessorId, String token, UUID key) throws Exception {
        return mockMvc.perform(post("/api/tasks/{id}/dependencies", id).header("Authorization", token)
                .header("Idempotency-Key", key).header("X-Correlation-ID", "workflow-test")
                .contentType(MediaType.APPLICATION_JSON).content(json(new TaskDependencyRequest(predecessorId, version))));
    }

    private ResultActions remove(UUID id, Long version, UUID predecessorId, UUID key) throws Exception {
        return mockMvc.perform(delete("/api/tasks/{id}/dependencies/{predecessorId}", id, predecessorId)
                .param("version", version.toString()).header("Authorization", studentToken)
                .header("Idempotency-Key", key).header("X-Correlation-ID", "workflow-test"));
    }

    private TaskDTO body(ResultActions result) throws Exception {
        return objectMapper.readValue(result.andReturn().getResponse().getContentAsByteArray(), TaskDTO.class);
    }

    private String json(Object value) throws Exception {
        return objectMapper.writeValueAsString(value);
    }

    private String token(String email) {
        var user = userDetailsService.loadUserByUsername(email);
        return "Bearer " + tokenService.generateAccessToken(new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities()));
    }

    private void synchronizeRequests() {
        synchronizeRequests(2);
    }

    private void synchronizeRequests(int count) {
        CyclicBarrier barrier = new CyclicBarrier(count);
        doAnswer(invocation -> {
            Object result = invocation.callRealMethod();
            barrier.await(15, TimeUnit.SECONDS);
            return result;
        }).when(outboxSpy).findReplay(anyLong(), any(), anyString());
    }
}
