package com.example.starter_project_2025.system.project.milestone.submission.repository;

import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import org.springframework.data.jpa.domain.Specification;

import java.util.UUID;

public final class MilestoneSubmissionSpecifications {
    private MilestoneSubmissionSpecifications() { }

    public static Specification<MilestoneSubmission> matching(
            UUID tenantId, UUID projectId, String search, SubmissionStatus status,
            MilestoneExecutionStatus executionStatus, Boolean mandatory, Boolean late,
            UUID reviewerId, String bucket) {
        return (root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("tenantId"), tenantId));
            if (projectId != null) predicates.add(cb.equal(root.get("projectId"), projectId));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            else if ("PENDING".equals(bucket)) predicates.add(cb.equal(root.get("status"), SubmissionStatus.SUBMITTED));
            else if ("REVIEWED".equals(bucket)) predicates.add(root.get("status").in(
                    SubmissionStatus.ACCEPTED, SubmissionStatus.REJECTED, SubmissionStatus.CHANGES_REQUESTED));
            if (executionStatus != null) predicates.add(cb.equal(root.get("executionStatus"), executionStatus));
            if (mandatory != null) predicates.add(cb.equal(root.get("milestone").get("mandatory"), mandatory));
            if (reviewerId != null) predicates.add(cb.equal(root.get("assignedReviewerId"), reviewerId));
            if (search != null && !search.isBlank()) {
                String escaped = search.toLowerCase().replace("\\", "\\\\")
                        .replace("%", "\\%").replace("_", "\\_");
                String pattern = "%" + escaped + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("milestone").get("title")), pattern, '\\'),
                        cb.like(cb.lower(root.get("teamName")), pattern, '\\'),
                        cb.like(cb.lower(root.get("studentName")), pattern, '\\')));
            }
            if (late != null) {
                var version = query.subquery(Long.class);
                var versionRoot = version.from(SubmissionVersion.class);
                version.select(cb.count(versionRoot));
                version.where(cb.equal(versionRoot.get("submission"), root),
                        cb.equal(versionRoot.get("versionNumber"), root.get("currentVersionNumber")),
                        cb.equal(versionRoot.get("late"), late));
                predicates.add(cb.greaterThan(version, 0L));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }
}
