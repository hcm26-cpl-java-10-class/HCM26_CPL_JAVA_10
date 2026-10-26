package com.example.starter_project_2025.system.project.milestone.repository;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class MilestoneSpecifications {

    private MilestoneSpecifications() {
    }

    public static Specification<Milestone> matching(
            Long tenantId,
            Long projectId,
            Long teamId,
            String search,
            List<MilestoneStatus> statuses,
            Boolean mandatory,
            List<LatePolicyType> latePolicyTypes,
            Instant deadlineFrom,
            Instant deadlineToExclusive
    ) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("tenantId"), tenantId));
            if (projectId != null) {
                predicates.add(criteriaBuilder.equal(root.get("projectId"), projectId));
            } else {
                predicates.add(criteriaBuilder.isNull(root.get("projectId")));
            }
            predicates.add(criteriaBuilder.isTrue(root.get("active")));
            if (teamId != null) {
                predicates.add(criteriaBuilder.equal(root.get("teamId"), teamId));
            }

            if (search != null) {
                String pattern = "%" + escapeLike(search.toLowerCase(Locale.ROOT)) + "%";
                Expression<String> title = criteriaBuilder.lower(root.get("title"));
                Expression<String> description = criteriaBuilder.lower(
                        criteriaBuilder.coalesce(root.get("description"), "")
                );
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(title, pattern, '\\'),
                        criteriaBuilder.like(description, pattern, '\\')
                ));
            }

            if (statuses != null && !statuses.isEmpty()) {
                predicates.add(root.get("status").in(statuses));
            }
            if (mandatory != null) {
                predicates.add(criteriaBuilder.equal(root.get("mandatory"), mandatory));
            }
            if (latePolicyTypes != null && !latePolicyTypes.isEmpty()) {
                predicates.add(root.get("latePolicyType").in(latePolicyTypes));
            }
            if (deadlineFrom != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("deadline"), deadlineFrom));
            }
            if (deadlineToExclusive != null) {
                predicates.add(criteriaBuilder.lessThan(root.get("deadline"), deadlineToExclusive));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String escapeLike(String value) {
        return value
                .replace("\\", "\\\\")
                .replace("%", "\\%")
                .replace("_", "\\_");
    }
}
