package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import org.springframework.stereotype.Component;
import java.util.Collection;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.Status;

/** Reporting override agreed for US-RPT-001; never changes the Project completion workflow. */
@Component
public class ProjectReportStatusPolicy {
    public Status evaluate(ProjectStatus project, Collection<MilestoneLifecycleStatus> milestones) {
        if (project == ProjectStatus.CANCELLED) return Status.CANCELLED;
        if (project == ProjectStatus.COMPLETED || !milestones.isEmpty()
                && milestones.stream().allMatch(state -> state == MilestoneLifecycleStatus.ACCEPTED)) return Status.DONE;
        if (milestones.contains(MilestoneLifecycleStatus.SUBMITTED)) return Status.SUBMITTED;
        if (project == ProjectStatus.DRAFT || project == ProjectStatus.PLANNING) return Status.NOT_STARTED;
        return Status.IN_PROGRESS;
    }
}
