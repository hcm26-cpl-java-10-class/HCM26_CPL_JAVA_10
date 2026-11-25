package com.example.starter_project_2025.system.project.analytics.demo;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Verifies the workspace analytics demo seed: a rolling 21-day sprint history
 * with back-dated work items and matching backlog audit transitions.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class WorkspaceAnalyticsDemoDataInitializerTest {

    static final String PROJECT_CODE = "ANA-DEMO-TEST";

    @Autowired ProjectRepository projects;
    @Autowired ProjectTeamRepository teams;
    @Autowired SprintRepository sprints;
    @Autowired SprintBacklogRepository backlogs;
    @Autowired SprintBacklogAuditRepository audits;
    @Autowired UserRepository users;
    @Autowired EntityManager entityManager;

    @Test
    void seedsRollingSprintHistoryWithBackDatedAuditTrail() {
        Project project = project();
        WorkspaceAnalyticsDemoDataInitializer initializer = initializer();

        initializer.run();

        LocalDate today = LocalDate.now();
        List<Sprint> created = sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId());
        assertEquals(4, created.size(), "three past sprints plus the sprint in flight");
        assertEquals(1, created.stream().filter(sprint -> sprint.getStatus() == SprintStatus.ACTIVE).count());
        assertEquals(3, created.stream().filter(sprint -> sprint.getStatus() == SprintStatus.COMPLETED).count());
        assertEquals(today.minusDays(WorkspaceAnalyticsDemoDataInitializer.WINDOW_DAYS),
                created.getLast().getStartDate().toLocalDate(), "oldest sprint starts 21 days ago");

        List<SprintBacklog> items = backlogs.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(List.of(project.getId()));
        assertTrue(items.size() >= 20, "expected a dense backlog, got " + items.size());
        assertTrue(items.stream().anyMatch(item -> item.getSprint() == null), "product backlog items expected");
        assertTrue(items.stream().anyMatch(item -> item.getStatus() == SprintBacklogStatus.DONE));
        assertTrue(items.stream().anyMatch(item -> item.getStatus() == SprintBacklogStatus.IN_PROGRESS));
        assertTrue(items.stream().anyMatch(item -> item.getStatus() == SprintBacklogStatus.REVIEW));
        assertTrue(items.stream().anyMatch(item -> item.getStatus() == SprintBacklogStatus.TODO));

        entityManager.clear();

        List<SprintBacklog> reloaded = backlogs.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(List.of(project.getId()));
        assertTrue(reloaded.stream().allMatch(item -> {
            LocalDate createdOn = item.getCreatedAt().toLocalDate();
            return !createdOn.isBefore(today.minusDays(WorkspaceAnalyticsDemoDataInitializer.WINDOW_DAYS))
                    && !createdOn.isAfter(today);
        }), "every work item is created inside the 21-day window");

        SprintBacklog payment = reloaded.stream()
                .filter(item -> item.getTitle().equals("Integrate the payment gateway"))
                .findFirst()
                .orElseThrow();
        Sprint hardening = sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId())
                .stream()
                .filter(sprint -> sprint.getName().equals("ANA Sprint 3 - Hardening"))
                .findFirst()
                .orElseThrow();
        LocalDate hardeningStart = hardening.getStartDate().toLocalDate();
        assertEquals(hardeningStart, payment.getCreatedAt().toLocalDate());

        List<SprintBacklogAuditLog> trail = audits.findBySprintBacklogIdOrderByCreatedAtDesc(payment.getId());
        assertEquals(3, trail.size(), "TODO → In progress → Review → Done");
        assertEquals(hardeningStart.plusDays(1), trail.get(2).getCreatedAt().toLocalDate());
        assertEquals(hardeningStart.plusDays(3), trail.get(1).getCreatedAt().toLocalDate());
        assertEquals(hardeningStart.plusDays(5), trail.get(0).getCreatedAt().toLocalDate());
        assertTrue(trail.stream().noneMatch(entry -> entry.getCreatedAt().toLocalDate().isAfter(today)),
                "no seeded transition may land in the future");

        // Idempotent: a restart never duplicates sprints or work items.
        initializer().run();
        entityManager.clear();
        assertEquals(created.size(),
                sprints.findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(project.getId()).size());
        assertEquals(reloaded.size(),
                backlogs.findAllByProjectIdInAndIsActiveTrueOrderByIdAsc(List.of(project.getId())).size());
    }

    private WorkspaceAnalyticsDemoDataInitializer initializer() {
        WorkspaceAnalyticsDemoDataInitializer initializer = new WorkspaceAnalyticsDemoDataInitializer(
                projects, teams, sprints, backlogs, audits, entityManager);
        ReflectionTestUtils.setField(initializer, "projectCode", PROJECT_CODE);
        ReflectionTestUtils.setField(initializer, "projectId", 0L);
        return initializer;
    }

    private Project project() {
        Long tenantId = users.findByEmail("admin@example.com").orElseThrow().getTenant().getId();
        return projects.findByCode(PROJECT_CODE).orElseGet(() -> {
            Project project = new Project();
            project.setCode(PROJECT_CODE);
            project.setName("Analytics Demo Test Workspace");
            project.setStatus(ProjectStatus.ACTIVE);
            project.setTenantId(tenantId);
            Project saved = projects.saveAndFlush(project);
            assertNotNull(saved.getId());
            return saved;
        });
    }
}
