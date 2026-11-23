package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.FinalProjectGrade;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneWaiver;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.FinalProjectGradeRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneWaiverRepository;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.*;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** In-memory project hierarchy, milestones, waivers and grades behind the completion services. */
class ProjectFinalizeFixture {
    static final Long TENANT = 7L;
    static final Long TEAM = 11L;
    static final UUID ACTOR = UUID.randomUUID();
    static final Instant NOW = Instant.parse("2026-11-23T03:00:00Z");

    final Map<Long, Project> projects = new LinkedHashMap<>();
    final List<Milestone> milestones = new ArrayList<>();
    final List<MilestoneWaiver> waivers = new ArrayList<>();
    final Map<Long, FinalProjectGrade> grades = new HashMap<>();

    final MilestoneRepository milestoneRepository = mock(MilestoneRepository.class);
    final MilestoneWaiverRepository waiverRepository = mock(MilestoneWaiverRepository.class);
    final ProjectRepository projectRepository = mock(ProjectRepository.class);
    final FinalProjectGradeRepository gradeRepository = mock(FinalProjectGradeRepository.class);
    final FakePort port = new FakePort();

    ProjectFinalizeFixture() {
        when(milestoneRepository.findAllByProjectIdAndTenantId(anyLong(), eq(TENANT), any(Pageable.class)))
                .thenAnswer(call -> new PageImpl<>(milestones.stream()
                        .filter(item -> item.getProjectId().equals(call.getArgument(0))).toList()));
        when(waiverRepository.findAllByTenantIdAndProjectIdAndTeamId(eq(TENANT), anyLong(), any()))
                .thenAnswer(call -> waivers.stream().filter(item -> item.getProjectId().equals(call.getArgument(1))
                        && Objects.equals(item.getTeamId(), call.getArgument(2))).toList());
        when(projectRepository.findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(anyLong()))
                .thenAnswer(call -> children(call.getArgument(0)));
        when(projectRepository.findById(anyLong())).thenAnswer(call -> Optional.ofNullable(projects.get(call.<Long>getArgument(0))));
        when(gradeRepository.findByTenantIdAndProjectIdAndTeamId(eq(TENANT), anyLong(), any()))
                .thenAnswer(call -> Optional.ofNullable(grades.get(call.<Long>getArgument(1))));
        when(gradeRepository.saveAndFlush(any(FinalProjectGrade.class))).thenAnswer(call -> {
            FinalProjectGrade grade = call.getArgument(0);
            grades.put(grade.getProjectId(), grade);
            return grade;
        });
    }

    ProjectCompletionReadiness readiness() {
        return new ProjectCompletionReadiness(milestoneRepository, waiverRepository, projectRepository, port);
    }

    ProjectCompletionService completionService() {
        return new ProjectCompletionService(port, gradeRepository, readiness());
    }

    Project project(Long id, Project parent, ProjectStatus status) {
        Project project = Project.builder().code("P" + id).name("Project " + id).tenantId(TENANT).teamId(TEAM)
                .status(status).parentProject(parent).build();
        project.setId(id);
        project.setIsActive(true);
        projects.put(id, project);
        return project;
    }

    Milestone milestone(Long projectId, boolean mandatory, MilestoneExecutionStatus target) {
        return milestone(projectId, TEAM, mandatory, target);
    }

    Milestone milestone(Long projectId, Long teamId, boolean mandatory, MilestoneExecutionStatus target) {
        Milestone milestone = Milestone.create(TENANT, projectId, teamId, "Milestone " + (milestones.size() + 1), null,
                NOW.plusSeconds(86_400), mandatory, null, null, null, null, null, ACTOR, NOW);
        ReflectionTestUtils.setField(milestone, "id", UUID.randomUUID());
        if (target != null) {
            milestone.openForWork(ACTOR, NOW);
            if (target != MilestoneExecutionStatus.TODO) milestone.setExecutionStatus(MilestoneExecutionStatus.IN_PROGRESS, ACTOR, NOW);
            if (target == MilestoneExecutionStatus.REVIEW || target == MilestoneExecutionStatus.DONE || target == MilestoneExecutionStatus.FAILED)
                milestone.setExecutionStatus(MilestoneExecutionStatus.REVIEW, ACTOR, NOW);
            if (target == MilestoneExecutionStatus.DONE || target == MilestoneExecutionStatus.FAILED)
                milestone.setExecutionStatus(target, ACTOR, NOW);
        }
        milestones.add(milestone);
        return milestone;
    }

    void waive(Milestone milestone) {
        waivers.add(MilestoneWaiver.create(TENANT, milestone.getProjectId(), milestone, milestone.getTeamId(),
                "Approved exception", ACTOR, NOW));
    }

    void lockGrade(Long projectId, String score) {
        grades.put(projectId, FinalProjectGrade.locked(TENANT, projectId, TEAM, new java.math.BigDecimal(score), ACTOR, NOW));
    }

    private List<Project> children(Long parentId) {
        return projects.values().stream().filter(project -> project.getParentProject() != null
                && project.getParentProject().getId().equals(parentId) && Boolean.TRUE.equals(project.getIsActive())).toList();
    }

    class FakePort implements ProjectCompletionPort {
        @Override public boolean isActive(Long projectId, Long tenantId) {
            Project project = projects.get(projectId);
            return project != null && TENANT.equals(tenantId) && project.getStatus() == ProjectStatus.ACTIVE;
        }

        @Override public boolean isCompleted(Long projectId, Long tenantId) {
            Project project = projects.get(projectId);
            return project != null && TENANT.equals(tenantId) && project.getStatus() == ProjectStatus.COMPLETED;
        }

        @Override public List<CompletionTarget> lockHierarchy(Long projectId, Long tenantId, Long teamId) {
            List<CompletionTarget> path = new ArrayList<>();
            for (Project current = projects.get(projectId); current != null; current = current.getParentProject())
                path.add(new CompletionTarget(current.getId(), current.getTeamId()));
            return path;
        }

        @Override public ChildCompletion childCompletion(Long projectId, Long tenantId) {
            List<Project> children = children(projectId);
            if (children.isEmpty()) return ChildCompletion.NONE;
            return children.stream().allMatch(child -> child.getStatus() == ProjectStatus.COMPLETED)
                    ? ChildCompletion.COMPLETED : ChildCompletion.PENDING;
        }

        @Override public boolean complete(Long projectId, Long tenantId, Long teamId, UUID actorId, Instant completedAt) {
            if (!isActive(projectId, tenantId)) return false;
            projects.get(projectId).setStatus(ProjectStatus.COMPLETED);
            return true;
        }
    }
}
