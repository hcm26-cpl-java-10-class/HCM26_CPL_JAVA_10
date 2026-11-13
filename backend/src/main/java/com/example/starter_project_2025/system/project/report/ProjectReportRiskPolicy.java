package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import org.springframework.stereotype.Component;
import java.time.Instant;

@Component
public class ProjectReportRiskPolicy {
    public record Flags(boolean overdue, boolean late) { }
    public Flags evaluate(MilestoneLifecycleStatus state, Instant deadline, boolean lateSubmission,
                          ProjectStatus project, Instant now) {
        boolean closed = project == ProjectStatus.COMPLETED || project == ProjectStatus.CANCELLED;
        boolean waitingForTeam = state != MilestoneLifecycleStatus.ACCEPTED
                && state != MilestoneLifecycleStatus.SUBMITTED;
        return new Flags(!closed && waitingForTeam && deadline != null && now.isAfter(deadline), lateSubmission);
    }
}
