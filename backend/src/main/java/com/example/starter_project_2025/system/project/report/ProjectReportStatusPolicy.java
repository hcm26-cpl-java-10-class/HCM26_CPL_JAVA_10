package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import org.springframework.stereotype.Component;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.Status;

/** Reports reflect the persisted Project lifecycle; milestone review never overrides it. */
@Component
public class ProjectReportStatusPolicy {
    public Status evaluate(ProjectStatus project) {
        if (project == null) throw new IllegalStateException("Project lifecycle status is missing");
        return Status.valueOf(project.name());
    }
}
