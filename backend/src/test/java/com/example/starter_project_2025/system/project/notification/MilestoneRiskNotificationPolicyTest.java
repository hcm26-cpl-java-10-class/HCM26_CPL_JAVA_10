package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionStatus;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MilestoneRiskNotificationPolicyTest {
    private final MilestoneRiskNotificationPolicy policy = new MilestoneRiskNotificationPolicy();
    private final Instant now = Instant.parse("2026-11-06T00:00:00Z");
    private final Duration warningWindow = Duration.ofHours(48);

    @Test
    void warnsForMissingSubmissionWhenDeadlineIsWithinFortyEightHours() {
        var reasons = evaluate(now.plus(Duration.ofHours(24)), false, false,
                MilestoneLifecycleStatus.IN_PROGRESS, null, 0);

        assertThat(reasons).containsExactly("the deadline is approaching and no submission is available");
    }

    @Test
    void identifiesMissingSubmissionAfterDeadlineHasPassed() {
        var reasons = evaluate(now.minusSeconds(1), false, false,
                MilestoneLifecycleStatus.IN_PROGRESS, null, 0);

        assertThat(reasons).containsExactly(
                "the deadline has passed without acceptance",
                "no submission is available");
    }

    @Test
    void overdueWorkMakesMilestoneRiskyEvenWhenItsDeadlineIsNotNear() {
        var reasons = evaluate(now.plus(Duration.ofDays(10)), false, false,
                MilestoneLifecycleStatus.IN_PROGRESS, SubmissionStatus.SUBMITTED, 2);

        assertThat(reasons).containsExactly("2 linked task/backlog item(s) are overdue");
    }

    @Test
    void rejectedSubmissionIsRiskyRegardlessOfTheMilestoneDeadline() {
        var reasons = evaluate(now.plus(Duration.ofDays(10)), false, false,
                MilestoneLifecycleStatus.CHANGES_REQUESTED, SubmissionStatus.CHANGES_REQUESTED, 0);

        assertThat(reasons).containsExactly("the submission was rejected or needs changes");
    }

    @Test
    void mandatoryMilestoneNearDeadlineRemainsRiskyEvenWithSubmissionPendingReview() {
        var reasons = evaluate(now.plus(Duration.ofHours(48)), true, false,
                MilestoneLifecycleStatus.SUBMITTED, SubmissionStatus.SUBMITTED, 0);

        assertThat(reasons).containsExactly("the mandatory milestone is not accepted yet");
    }

    @Test
    void acceptedOrWaivedMilestonesNeverGenerateRiskNotifications() {
        assertThat(evaluate(now.minusSeconds(1), true, false, MilestoneLifecycleStatus.ACCEPTED,
                SubmissionStatus.ACCEPTED, 1)).isEmpty();
        assertThat(evaluate(now.minusSeconds(1), true, true, MilestoneLifecycleStatus.IN_PROGRESS,
                null, 1)).isEmpty();
    }

    private java.util.List<String> evaluate(Instant deadline, boolean mandatory, boolean waived,
                                            MilestoneLifecycleStatus lifecycleStatus,
                                            SubmissionStatus submissionStatus, long overdueWork) {
        return policy.reasons(new MilestoneRiskNotificationPolicy.Facts(deadline, mandatory, waived,
                lifecycleStatus, submissionStatus, overdueWork), now, warningWindow);
    }
}
