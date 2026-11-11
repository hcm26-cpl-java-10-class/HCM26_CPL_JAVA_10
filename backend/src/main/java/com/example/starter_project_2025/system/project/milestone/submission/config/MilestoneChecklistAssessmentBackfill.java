package com.example.starter_project_2025.system.project.milestone.submission.config;

import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneReviewRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reviews saved before the checklist sync existed only updated the submission's checklist snapshot, so their
 * milestones still show every acceptance item as open. Replaying reviews oldest first applies each milestone's latest
 * assessment. Idempotent: an already synced milestone ends in the same state and is not rewritten.
 * Runs last so seeded demo reviews are included.
 */
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class MilestoneChecklistAssessmentBackfill implements ApplicationRunner {
    private final MilestoneReviewRepository reviews;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (var review : reviews.findAllOfTeamMilestonesOldestFirst()) {
            var version = review.getSubmissionVersion();
            version.getSubmission().getMilestone().applyChecklistAssessment(version.checklistAssessmentBySourceItem());
        }
    }
}
