package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.ArrayList;
import java.util.Locale;

public final class WorkspaceCandidateSpec {
    private WorkspaceCandidateSpec() { }

    public static Specification<Team> forTeamList(WorkspaceCandidateFilter filter) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (filter != null) {
                if (filter.getProjectId() != null) predicates.add(cb.equal(root.get("project").get("id"), filter.getProjectId()));
                if (filter.getCohortId() != null) predicates.add(cb.equal(root.get("project").get("cohort").get("id"), filter.getCohortId()));
                if (filter.getProjectStatus() != null) predicates.add(cb.equal(root.get("project").get("status"), filter.getProjectStatus()));
                if (filter.getProjectName() != null && !filter.getProjectName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("project").get("name")), pattern(filter.getProjectName()), '\\'));
                if (filter.getTeamName() != null && !filter.getTeamName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("name")), pattern(filter.getTeamName()), '\\'));
                if (Boolean.TRUE.equals(filter.getOnlyUncreated()) || filter.getWorkspaceStatus() != null) {
                    var workspace = query.subquery(Long.class);
                    var row = workspace.from(Workspace.class);
                    var matches = cb.equal(row.get("team").get("id"), root.get("id"));
                    if (filter.getWorkspaceStatus() != null) matches = cb.and(matches, cb.equal(row.get("status"), filter.getWorkspaceStatus()));
                    workspace.select(row.get("id")).where(matches);
                    predicates.add(Boolean.TRUE.equals(filter.getOnlyUncreated()) ? cb.not(cb.exists(workspace)) : cb.exists(workspace));
                    if (Boolean.TRUE.equals(filter.getOnlyUncreated()) && filter.getWorkspaceStatus() != null) predicates.add(cb.disjunction());
                }
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static String pattern(String text) {
        return "%" + text.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    public static Specification<Team> forScope(Long userId, Long tenantId) {
        return (root, query, cb) -> {
            if (userId == null || tenantId == null) return cb.disjunction();
            var project = root.join("project", jakarta.persistence.criteria.JoinType.LEFT);
            Predicate scoped = cb.and(cb.equal(root.get("tenant").get("id"), tenantId), cb.isTrue(root.get("isActive")),
                    cb.or(cb.isNull(project.get("id")), cb.and(cb.equal(project.get("tenant").get("id"), tenantId), cb.isTrue(project.get("isActive")))));
            if (hasRole("ADMIN") || hasRole("PO")) return scoped;
            // EXISTS avoids duplicate rows/counts when a team has several members.
            var membership = query.subquery(Long.class);
            var member = membership.from(TeamMember.class);
            membership.select(member.get("id")).where(cb.equal(member.get("team").get("id"), root.get("id")),
                    cb.equal(member.get("user").get("id"), userId), cb.isTrue(member.get("isActive")),
                    cb.equal(member.get("participationStatus"), ParticipationStatus.ACTIVE));
            return cb.and(scoped, cb.or(cb.equal(root.get("mentor").get("id"), userId), cb.exists(membership)));
        };
    }

    public static boolean hasRole(String roleName) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UserPrincipal && auth.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equalsIgnoreCase("ROLE_" + roleName));
    }
}

