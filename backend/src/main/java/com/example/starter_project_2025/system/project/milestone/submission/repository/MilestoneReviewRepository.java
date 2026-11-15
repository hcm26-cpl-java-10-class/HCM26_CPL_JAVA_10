package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneReview;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface MilestoneReviewRepository extends JpaRepository<MilestoneReview, UUID> {
    boolean existsBySubmissionVersionId(UUID versionId);

    @EntityGraph(attributePaths = "evaluations")
    Optional<MilestoneReview> findBySubmissionVersionId(UUID versionId);

    @EntityGraph(attributePaths = {"submissionVersion", "evaluations"})
    List<MilestoneReview> findAllBySubmissionVersionSubmissionIdOrderByReviewedAtDesc(UUID submissionId);

    /** Reviews of team milestones, oldest first, so replaying them leaves each milestone with its latest assessment. */
    @org.springframework.data.jpa.repository.Query("select r from MilestoneReview r join fetch r.submissionVersion v "
            + "join fetch v.submission s join fetch s.milestone m where m.teamId is not null order by r.reviewedAt asc")
    List<MilestoneReview> findAllOfTeamMilestonesOldestFirst();
}
