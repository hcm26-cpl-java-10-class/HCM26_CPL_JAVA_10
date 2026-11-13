package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

/**
 * US-ANL-001: read-only Analytics workspace shell.
 *
 * <p>Every method runs in a read-only transaction and only performs lookups.
 * No sprint, task or audit row is written when the Analytics route is opened
 * (Read-Only Guarantee).</p>
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectAnalyticsService {

    private static final String PLACEHOLDER = "PLACEHOLDER";

    private static final List<String> PLANNED_FILTERS =
            List.of("Sprint", "Work item status", "Member", "Date range");

    /**
     * The 2x2 grid is fixed by US-ANL-001. The follow-up analytics stories fill
     * in each widget; until then each card reports an explicit placeholder
     * state so the UI never implies that data is missing.
     */
    private static final List<ProjectAnalyticsResponse.Widget> WIDGETS = List.of(
            new ProjectAnalyticsResponse.Widget("sprint-burndown", "Sprint Burndown",
                    "Remaining work per day across the active sprint.", PLACEHOLDER),
            new ProjectAnalyticsResponse.Widget("sprint-velocity", "Sprint Velocity",
                    "Planned versus completed work across recent sprints.", PLACEHOLDER),
            new ProjectAnalyticsResponse.Widget("backlog-health", "Backlog Health",
                    "Backlog size, age and readiness of unattached work items.", PLACEHOLDER),
            new ProjectAnalyticsResponse.Widget("team-workload", "Team Workload",
                    "Work distribution and capacity across team members.", PLACEHOLDER)
    );

    private final ProjectAnalyticsAccess access;
    private final ProjectRepository projects;

    public ProjectAnalyticsResponse shell(String rawProjectId) {
        User user = access.requireUser();
        Project project = access.requireProject(user, rawProjectId);
        return new ProjectAnalyticsResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                project.getStatus() == null ? null : project.getStatus().name(),
                true,
                new ProjectAnalyticsResponse.Filters(PLACEHOLDER, PLANNED_FILTERS),
                WIDGETS
        );
    }

    /**
     * US-ANL-001: projects the caller may open Analytics for. Used by the
     * Learning Analytics project selector; every option has already passed the
     * same membership/mentor/PM scope check as the analytics endpoint.
     */
    public List<ProjectAnalyticsProjectOption> projects() {
        User user = access.requireUser();
        return projects.findByTenantIdAndIsActiveTrue(user.getTenantId()).stream()
                .filter(project -> access.canView(user, project))
                .sorted(Comparator.comparing(Project::getName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(Project::getId))
                .map(project -> new ProjectAnalyticsProjectOption(
                        project.getId(),
                        project.getCode(),
                        project.getName(),
                        project.getStatus() == null ? null : project.getStatus().name()))
                .toList();
    }
}
