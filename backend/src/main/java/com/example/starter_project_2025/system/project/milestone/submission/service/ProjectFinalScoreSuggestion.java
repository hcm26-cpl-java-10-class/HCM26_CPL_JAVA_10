package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneReview;
import com.example.starter_project_2025.system.project.milestone.submission.domain.ReviewDecision;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneReviewRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Suggests a 0–100 final score from the latest accepted review of every accepted, non-waived milestone,
 * weighted by {@link Milestone#getWeight()} (equal weights when any scored milestone has no weight).
 * The reviewer may override the suggestion when finalizing.
 */
@Component
@RequiredArgsConstructor
public class ProjectFinalScoreSuggestion {
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final MilestoneReviewRepository reviews;
    private final RubricVersionRepository rubrics;

    private record Scored(BigDecimal percent, BigDecimal weight) { }

    public BigDecimal suggest(Long tenantId, Long projectId, Long teamId, Set<UUID> waived) {
        List<Scored> scored = new ArrayList<>();
        for (Milestone milestone : milestones.findAllByProjectIdAndTenantId(projectId, tenantId, Pageable.unpaged())) {
            if (!milestone.isActive() || !Objects.equals(teamId, milestone.getTeamId()) || waived.contains(milestone.getId())
                    || milestone.lifecycleStatus() != MilestoneLifecycleStatus.ACCEPTED) continue;
            percent(milestone, teamId).ifPresent(percent -> scored.add(new Scored(percent, milestone.getWeight())));
        }
        if (scored.isEmpty()) return null;
        boolean weighted = scored.stream().allMatch(item -> item.weight() != null && item.weight().signum() > 0);
        BigDecimal total = BigDecimal.ZERO;
        BigDecimal weights = BigDecimal.ZERO;
        for (Scored item : scored) {
            BigDecimal weight = weighted ? item.weight() : BigDecimal.ONE;
            total = total.add(item.percent().multiply(weight));
            weights = weights.add(weight);
        }
        return total.divide(weights, 2, RoundingMode.HALF_UP).max(BigDecimal.ZERO).min(HUNDRED);
    }

    private Optional<BigDecimal> percent(Milestone milestone, Long teamId) {
        if (milestone.getRubricSnapshotId() == null) return Optional.empty();
        Optional<BigDecimal> maxScore = rubrics.findById(milestone.getRubricSnapshotId())
                .map(RubricVersion::getTotalMaxScore).filter(value -> value.signum() > 0);
        if (maxScore.isEmpty()) return Optional.empty();
        return submissions.findByMilestoneIdAndTeamId(milestone.getId(), teamId)
                .flatMap(submission -> reviews.findAllBySubmissionVersionSubmissionIdOrderByReviewedAtDesc(submission.getId()).stream()
                        .filter(review -> review.getDecision() == ReviewDecision.ACCEPT).findFirst())
                .map(MilestoneReview::getFinalScore)
                .map(score -> score.multiply(HUNDRED).divide(maxScore.get(), 4, RoundingMode.HALF_UP));
    }
}
