package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import org.springframework.stereotype.Component;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.Status;

/** Project lifecycle with a publication gate for shared Masters; never derived from milestone review. */
@Component
public class ProjectReportStatusPolicy {
    public Status evaluate(ProjectStatus project) {
        return evaluate(project, false);
    }
    public Status evaluate(ProjectStatus project, boolean awaitingPublication) {
        if (project == null) throw new IllegalStateException("Project lifecycle status is missing");
        // SPLIT provisioning creates an ACTIVE shared root even while all its teams are DRAFT.
        if (project == ProjectStatus.ACTIVE && awaitingPublication) return Status.PLANNING;
        return Status.valueOf(project.name());
    }
}
