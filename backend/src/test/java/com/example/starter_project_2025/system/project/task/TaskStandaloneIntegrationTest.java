package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.auth.token.refresh.RefreshTokenService;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditRepository;
import com.example.starter_project_2025.system.project.task.event.TaskOutboxRepository;
import com.example.starter_project_2025.system.project.task.tag.TagRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.role.RoleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:task_standalone;DB_CLOSE_DELAY=-1",
        "app.sprint.outbox.initial-delay-ms=3600000"
})
@AutoConfigureMockMvc
class TaskStandaloneIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired TaskRepository taskRepository;
    @Autowired TagRepository tagRepository;
    @Autowired TaskAuditRepository auditRepository;
    @Autowired TaskOutboxRepository outboxRepository;
    @Autowired UserDetailsService userDetailsService;
    @Autowired UserRepository userRepository;
    @Autowired RoleRepository roleRepository;
    @Autowired RefreshTokenService tokenService;
    @Autowired TransactionTemplate transactionTemplate;

    private UUID projectId;
    private String studentToken;
    private String teacherToken;

    @BeforeEach
    void setUp() {
        taskRepository.deleteAll();
        tagRepository.deleteAll();
        auditRepository.deleteAll();
        outboxRepository.deleteAll();
        projectId = UUID.randomUUID();
        studentToken = token("student@example.com");
        teacherToken = token("teacher@example.com");
    }

    @Test
    void creatorCanCreateReadAndUpdateUnassignedTaskWithoutProjectModule() throws Exception {
        TaskDTO request = TaskDTO.builder().projectId(projectId).title("Task chưa giao").build();
        TaskDTO created = create(request, studentToken);
        assertNotNull(created.getId());
        assertNull(created.getAssigneeProjectMemberId());
        assertNull(created.getEstimatedHours());
        created.setTitle("Đã chỉnh sửa");
        created.setTags(List.of("Backend"));

        mockMvc.perform(put("/api/tasks/" + created.getId()).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsBytes(created)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Đã chỉnh sửa"));
        mockMvc.perform(get("/api/tasks/" + created.getId()).header("Authorization", studentToken))
                .andExpect(status().isOk()).andExpect(jsonPath("$.tags[0]").value("Backend"));
        assertEquals(2, auditRepository.count());
        assertEquals(2, outboxRepository.count());
    }

    @Test
    void missingProjectMappingDoesNotExposeAnotherCreatorsTasksOrTags() throws Exception {
        TaskDTO studentRequest = TaskDTO.builder().projectId(projectId).title("Student task")
                .tags(List.of("StudentOnly")).build();
        TaskDTO studentTask = create(studentRequest, studentToken);
        create(TaskDTO.builder().projectId(projectId).title("Teacher task").tags(List.of("TeacherOnly")).build(),
                teacherToken);

        mockMvc.perform(get("/api/tasks").header("Authorization", studentToken)
                        .param("projectId", projectId.toString()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.content", hasSize(1)))
                .andExpect(jsonPath("$.content[0].title").value("Student task"));
        mockMvc.perform(get("/api/tasks/tags").header("Authorization", studentToken)
                        .param("projectId", projectId.toString()))
                .andExpect(status().isOk()).andExpect(content().json("[\"StudentOnly\"]"));
        mockMvc.perform(get("/api/tasks/" + studentTask.getId()).header("Authorization", teacherToken))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/tasks/" + studentTask.getId()).header("Authorization", teacherToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsBytes(studentTask)))
                .andExpect(status().isForbidden());
    }

    @Test
    void assigneeMemberIdIsNotTreatedAsAnAuthenticatedUserId() throws Exception {
        TaskDTO created = create(TaskDTO.builder().projectId(projectId).title("Task đã giao")
                .assigneeProjectMemberId(UUID.randomUUID()).estimatedHours(2.0).build(), studentToken);

        mockMvc.perform(put("/api/tasks/" + created.getId()).header("Authorization", studentToken)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsBytes(created)))
                .andExpect(status().isForbidden());
    }

    @Test
    void authenticatedUserWithoutTaskPermissionCannotAccessTaskApi() throws Exception {
        String email = "task-no-permission@example.com";
        if (userRepository.findByEmail(email).isEmpty()) {
            Role role = roleRepository.save(Role.builder().name("TASK_TEST_VIEWER")
                    .permissions(new HashSet<>()).build());
            userRepository.save(User.builder().email(email).firstName("No permission").lastName("User")
                    .passwordHash("unused").roles(new HashSet<>(Set.of(role))).build());
        }
        mockMvc.perform(get("/api/tasks").header("Authorization", token(email))
                        .param("projectId", projectId.toString()))
                .andExpect(status().isForbidden());
    }

    private TaskDTO create(TaskDTO request, String token) throws Exception {
        byte[] response = mockMvc.perform(post("/api/tasks").header("Authorization", token)
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsBytes(request)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        return objectMapper.readValue(response, TaskDTO.class);
    }

    private String token(String email) {
        return transactionTemplate.execute(status -> {
            var principal = userDetailsService.loadUserByUsername(email);
            return "Bearer " + tokenService.generateAccessToken(new UsernamePasswordAuthenticationToken(
                    principal, null, principal.getAuthorities()));
        });
    }
}
