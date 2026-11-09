package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Component
public class MilestoneRiskNotificationPolicy {
    public List<String> reasons(Facts facts, Instant now, Duration warningWindow) {
        if (facts.waived() || facts.lifecycleStatus() == MilestoneLifecycleStatus.ACCEPTED
                || facts.submissionStatus() == SubmissionStatus.ACCEPTED) return List.of();

        List<String> reasons = new ArrayList<>();
        boolean overdue = !facts.deadline().isAfter(now);
        boolean nearDeadline = !overdue && !facts.deadline().isAfter(now.plus(warningWindow));
        boolean noSubmission = facts.submissionStatus() == null
                || facts.submissionStatus() == SubmissionStatus.DRAFT;
        boolean rejectedOrRevisionRequested = facts.submissionStatus() == SubmissionStatus.REJECTED
                || facts.submissionStatus() == SubmissionStatus.CHANGES_REQUESTED
                || facts.lifecycleStatus() == MilestoneLifecycleStatus.REJECTED
                || facts.lifecycleStatus() == MilestoneLifecycleStatus.CHANGES_REQUESTED;

        if (overdue) reasons.add("the deadline has passed without acceptance");
        if (overdue && noSubmission)
            reasons.add("no submission is available");
        if (nearDeadline && noSubmission)
            reasons.add("the deadline is approaching and no submission is available");
        if (nearDeadline && !noSubmission && facts.mandatory())
            reasons.add("the mandatory milestone is not accepted yet");
        if (rejectedOrRevisionRequested) reasons.add("the submission was rejected or needs changes");
        if (facts.overdueWorkItems() > 0)
            reasons.add(facts.overdueWorkItems() + " linked task/backlog item(s) are overdue");
        return List.copyOf(reasons);
    }

    public record Facts(Instant deadline, boolean mandatory, boolean waived,
                        MilestoneLifecycleStatus lifecycleStatus, SubmissionStatus submissionStatus,
                        long overdueWorkItems) {
        public Facts {
            if (deadline == null || lifecycleStatus == null || overdueWorkItems < 0)
                throw new IllegalArgumentException("Invalid milestone risk facts");
        }
    }
}
