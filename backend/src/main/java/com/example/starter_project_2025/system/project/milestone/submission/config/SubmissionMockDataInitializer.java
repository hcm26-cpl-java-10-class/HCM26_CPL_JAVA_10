package com.example.starter_project_2025.system.project.milestone.submission.config;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import com.example.starter_project_2025.system.project.rubric.domain.*;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.*;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;

@Slf4j
@Component
@Profile("!milestone-real-integrations")
@Order(13)
@RequiredArgsConstructor
public class SubmissionMockDataInitializer implements CommandLineRunner {
    public static final UUID TEAM_ID = UUID.fromString("66666666-6666-6666-6666-666666666666");
    public static final UUID STUDENT_ID = UUID.nameUUIDFromBytes("student@example.com".getBytes(StandardCharsets.UTF_8));
    public static final UUID REVIEWER_ID = UUID.nameUUIDFromBytes("teacher@example.com".getBytes(StandardCharsets.UTF_8));

    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final SubmissionVersionRepository versions;
    private final MilestoneReviewRepository reviews;
    private final RubricVersionRepository rubrics;
    private final FinalProjectGradeRepository finalGrades;
    private final Clock milestoneClock;

    @Value("${milestone.submission.mock.seed-enabled:true}") private boolean enabled;

    @Override
    @Transactional
    public void run(String... args) {
        if (!enabled) return;
        seed("Core Feature MVP", SubmissionStatus.SUBMITTED, RubricRatingLevel.GOOD,
                "The implementation is ready for a structured review.");
        seed("Requirements and Architecture Review", SubmissionStatus.CHANGES_REQUESTED, RubricRatingLevel.FAIR,
                "Please address this criterion in the next version.");
        seed("Sprint Demo 1", SubmissionStatus.ACCEPTED, RubricRatingLevel.EXCELLENT,
                "The criterion is fully satisfied.");
        seed("Project Kickoff and Scope Confirmation", SubmissionStatus.REJECTED, RubricRatingLevel.NOT_MET,
                "The submitted evidence does not satisfy this criterion.");
        seedDraft("Testing and Quality Gate");
        seedPendingReviewExamples();
        if (finalGrades.findByTenantIdAndProjectIdAndTeamId(
                MockMilestoneData.TENANT_ID, MockMilestoneData.PROJECT_ID, TEAM_ID).isEmpty()) {
            finalGrades.save(FinalProjectGrade.locked(MockMilestoneData.TENANT_ID,
                    MockMilestoneData.PROJECT_ID, TEAM_ID, new BigDecimal("8.25"), REVIEWER_ID,
                    milestoneClock.instant()));
        }
        log.info("Ensured sample milestone submissions and reviews.");
    }

    private void seedPendingReviewExamples() {
        List<PendingSubmissionSample> samples = List.of(
                new PendingSubmissionSample("Project Kickoff and Scope Confirmation", "Atlas Team", "An Nguyen"),
                new PendingSubmissionSample("Requirements and Architecture Review", "Byte Builders", "Binh Tran"),
                new PendingSubmissionSample("Sprint Demo 1", "Code Crafters", "Chi Le"),
                new PendingSubmissionSample("Testing and Quality Gate", "Delta Squad", "Dung Pham"),
                new PendingSubmissionSample("Final Documentation", "Eclipse Team", "Giang Vo"),
                new PendingSubmissionSample("Final Product Presentation", "Fusion Lab", "Huy Do")
        );
        for (int index = 0; index < samples.size(); index++) {
            seedPendingReview(samples.get(index), index);
        }
    }

    private void seedPendingReview(PendingSubmissionSample sample, int index) {
        Milestone milestone = requireMilestone(sample.milestoneTitle());
        UUID teamId = stableId("milestone-submission-team:" + sample.teamName());
        if (submissions.findByMilestoneIdAndTeamId(milestone.getId(), teamId).isPresent()) return;

        UUID studentId = stableId("milestone-submission-student:" + sample.studentName());
        Instant submittedAt = milestoneClock.instant().minusSeconds(900L * (index + 1));
        UUID reviewerId = milestone.getReviewerId() == null ? REVIEWER_ID : milestone.getReviewerId();
        MilestoneSubmission submission = MilestoneSubmission.create(milestone, teamId, sample.teamName(),
                studentId, sample.studentName(), reviewerId, "Assigned Mentor",
                submittedAt.minusSeconds(7200));
        submissions.saveAndFlush(submission);

        String slug = sample.teamName().toLowerCase(Locale.ROOT).replace(' ', '-');
        SubmissionVersion version = SubmissionVersion.draft(submission, 1,
                sample.milestoneTitle() + " · " + sample.teamName(),
                "Submission is ready and waiting for mentor review.",
                "https://example.com/submissions/" + slug,
                studentId, submittedAt.minusSeconds(3600));
        version.replaceArtifacts(List.of(
                new SubmissionVersion.ArtifactValue(SubmissionArtifactType.REPOSITORY,
                        sample.teamName() + " repository", "https://github.com/example/" + slug),
                new SubmissionVersion.ArtifactValue(SubmissionArtifactType.DOCUMENTATION,
                        sample.teamName() + " documentation", "https://example.com/docs/" + slug)
        ));
        int completedItems = Math.max(1, milestone.getChecklistItems().size() - (index % 2));
        version.replaceChecklist(milestone.getChecklistItems().stream().map(item ->
                new SubmissionVersion.ChecklistValue(item.getId(), item.getContent(), item.isMandatory(),
                        item.getOrderIndex() < completedItems, null)).toList());
        boolean late = submittedAt.isAfter(milestone.getDeadline());
        BigDecimal penalty = late && milestone.getLatePenaltyPercent() != null
                ? milestone.getLatePenaltyPercent() : BigDecimal.ZERO;
        version.submit(submittedAt, late, penalty);
        versions.saveAndFlush(version);
        submission.submitted(1, submittedAt);
        submissions.save(submission);
    }

    private UUID stableId(String value) {
        return UUID.nameUUIDFromBytes(value.getBytes(StandardCharsets.UTF_8));
    }

    private record PendingSubmissionSample(String milestoneTitle, String teamName, String studentName) { }

    private void seed(String title, SubmissionStatus target, RubricRatingLevel ratingLevel, String feedback) {
        Milestone milestone = requireMilestone(title);
        if (submissions.findByMilestoneIdAndTeamId(milestone.getId(), TEAM_ID).isPresent()) return;
        Instant now = milestoneClock.instant().minusSeconds(3600);
        MilestoneSubmission submission = MilestoneSubmission.create(milestone, TEAM_ID, "Nova Team",
                STUDENT_ID, "Student Demo", REVIEWER_ID, "Mentor Reviewer", now.minusSeconds(7200));
        submissions.saveAndFlush(submission);
        SubmissionVersion version = SubmissionVersion.draft(submission, 1, title + " delivery",
                "Demo submission seeded for review workflow.", "https://example.com/submissions/" + milestone.getId(),
                STUDENT_ID, now.minusSeconds(7200));
        populateVersion(version, milestone);
        boolean late = now.isAfter(milestone.getDeadline());
        BigDecimal penalty = late && milestone.getLatePenaltyPercent() != null
                ? milestone.getLatePenaltyPercent() : BigDecimal.ZERO;
        version.submit(now, late, penalty);
        versions.saveAndFlush(version);
        submission.submitted(1, now);
        if (target != SubmissionStatus.SUBMITTED) {
            ReviewDecision decision = switch (target) {
                case ACCEPTED -> ReviewDecision.ACCEPT;
                case REJECTED -> ReviewDecision.REJECT;
                case CHANGES_REQUESTED -> ReviewDecision.REQUEST_CHANGES;
                default -> throw new IllegalArgumentException("Unsupported seed status");
            };
            seedReview(submission, version, decision, ratingLevel, feedback, now.plusSeconds(600));
        }
        submissions.save(submission);
    }

    private void seedReview(MilestoneSubmission submission, SubmissionVersion version, ReviewDecision decision,
                            RubricRatingLevel level, String feedback, Instant reviewedAt) {
        RubricVersion rubric = rubrics.findByIdAndRubricTenantId(
                submission.getMilestone().getRubricSnapshotId(), MockMilestoneData.TENANT_ID).orElseThrow();
        BigDecimal raw = BigDecimal.ZERO;
        List<Object[]> values = new ArrayList<>();
        for (RubricCriterion criterion : rubric.getCriteria()) {
            RubricCriterionRating rating = criterion.getRatings().stream()
                    .filter(item -> item.getLevel() == level).findFirst().orElseThrow();
            BigDecimal score = criterion.getMaxScore().multiply(rating.getPercentage())
                    .divide(new BigDecimal("100.00"), 2, RoundingMode.HALF_UP);
            raw = raw.add(score);
            values.add(new Object[]{criterion, rating, score});
        }
        BigDecimal finalScore = raw.multiply(new BigDecimal("100.00").subtract(version.getPenaltyPercent()))
                .divide(new BigDecimal("100.00"), 2, RoundingMode.HALF_UP);
        MilestoneReview review = MilestoneReview.create(version, decision, REVIEWER_ID,
                "Mentor Reviewer", raw, version.getPenaltyPercent(), finalScore, reviewedAt);
        for (Object[] value : values) {
            RubricCriterion criterion = (RubricCriterion) value[0];
            RubricCriterionRating rating = (RubricCriterionRating) value[1];
            review.addEvaluation(criterion.getId(), criterion.getCode(), criterion.getName(), rating.getId(),
                    rating.getLevel().name(), rating.getPercentage(), (BigDecimal) value[2], feedback,
                    criterion.getOrderIndex());
        }
        reviews.save(review);
        version.applyDecision(decision);
        submission.reviewed(decision, reviewedAt);
    }

    private void seedDraft(String title) {
        Milestone milestone = requireMilestone(title);
        if (submissions.findByMilestoneIdAndTeamId(milestone.getId(), TEAM_ID).isPresent()) return;
        Instant now = milestoneClock.instant().minusSeconds(1800);
        MilestoneSubmission submission = MilestoneSubmission.create(milestone, TEAM_ID, "Nova Team",
                STUDENT_ID, "Student Demo", REVIEWER_ID, "Mentor Reviewer", now);
        submissions.saveAndFlush(submission);
        SubmissionVersion version = SubmissionVersion.draft(submission, 1, title + " draft",
                "Work in progress.", null, STUDENT_ID, now);
        populateVersion(version, milestone);
        versions.save(version);
    }

    private void populateVersion(SubmissionVersion version, Milestone milestone) {
        version.replaceArtifacts(List.of(
                new SubmissionVersion.ArtifactValue(SubmissionArtifactType.REPOSITORY,
                        "Source repository", "https://github.com/example/mock-project"),
                new SubmissionVersion.ArtifactValue(SubmissionArtifactType.DOCUMENTATION,
                        "Technical documentation", "https://example.com/docs/" + milestone.getId())
        ));
        version.replaceChecklist(milestone.getChecklistItems().stream().map(item ->
                new SubmissionVersion.ChecklistValue(item.getId(), item.getContent(), item.isMandatory(),
                        item.getOrderIndex() < Math.max(1, milestone.getChecklistItems().size() - 1), null)).toList());
    }

    private Milestone requireMilestone(String title) {
        return milestones.findByTenantIdAndProjectIdAndTitle(
                MockMilestoneData.TENANT_ID, MockMilestoneData.PROJECT_ID, title).orElseThrow();
    }
}
