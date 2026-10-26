package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignment;
import com.example.starter_project_2025.system.project.trainingclass.UserDataScope;
import com.example.starter_project_2025.system.project.trainingclass.UserScopeType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.ArrayList;
import java.util.Locale;

public final class WorkspaceCandidateSpec {
    private WorkspaceCandidateSpec() { }

    public static Specification<ProjectTeam> forTeamList(WorkspaceCandidateFilter filter) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            predicates.add(cb.equal(root.get("status"), ProjectTeamStatus.ACTIVE));
            predicates.add(cb.isTrue(root.get("isActive")));
            predicates.add(cb.isTrue(root.get("trainingClass").get("isActive")));
            if (filter != null) {
                if (filter.getProjectId() != null) predicates.add(cb.equal(root.get("project").get("id"), filter.getProjectId()));
                if (filter.getCohortId() != null) predicates.add(cb.equal(root.get("trainingClass").get("cohortId"), filter.getCohortId()));
                if (filter.getProjectStatus() != null) predicates.add(cb.equal(root.get("project").get("status"), filter.getProjectStatus()));
                if (filter.getProjectName() != null && !filter.getProjectName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("project").get("name")), pattern(filter.getProjectName()), '\\'));
                if (filter.getTeamName() != null && !filter.getTeamName().isBlank())
                    predicates.add(cb.like(cb.lower(root.get("teamName")), pattern(filter.getTeamName()), '\\'));
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

    public static Specification<ProjectTeam> forScope(Long userId, Long tenantId) {
        return (root, query, cb) -> {
            if (userId == null || tenantId == null) return cb.disjunction();
            Predicate scoped = cb.equal(root.get("trainingClass").get("tenantId"), tenantId);
            if (hasRole("SUPER_ADMIN") || hasRole("ADMIN") || hasRole("PO")) return scoped;
            var membership = query.subquery(Long.class);
            var member = membership.from(ProjectMember.class);
            membership.select(member.get("id")).where(cb.equal(member.get("team").get("id"), root.get("id")),
                    cb.equal(member.get("classMember").get("user").get("id"), userId),
                    cb.equal(member.get("classMember").get("status"),
                            com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE));
            var staff = query.subquery(Long.class);
            var assignment = staff.from(ClassStaffAssignment.class);
            staff.select(assignment.get("id")).where(
                    cb.equal(assignment.get("trainingClass").get("id"), root.get("trainingClass").get("id")),
                    cb.equal(assignment.get("user").get("id"), userId),
                    cb.isTrue(assignment.get("isActive")));
            var dataScope = query.subquery(Long.class);
            var scope = dataScope.from(UserDataScope.class);
            Predicate scopeMatch = cb.and(
                    cb.equal(scope.get("user").get("id"), userId),
                    cb.equal(scope.get("tenantId"), tenantId),
                    cb.isTrue(scope.get("isActive")),
                    cb.or(
                            cb.and(cb.equal(scope.get("scopeType"), UserScopeType.TENANT),
                                    cb.equal(scope.get("targetId"), tenantId)),
                            cb.and(cb.equal(scope.get("scopeType"), UserScopeType.PROGRAM),
                                    cb.equal(scope.get("targetId"),
                                            root.get("trainingClass").get("programId"))),
                            cb.and(cb.equal(scope.get("scopeType"), UserScopeType.COHORT),
                                    cb.equal(scope.get("targetId"),
                                            root.get("trainingClass").get("cohortId"))),
                            cb.and(cb.equal(scope.get("scopeType"), UserScopeType.CLASS),
                                    cb.equal(scope.get("targetId"),
                                            root.get("trainingClass").get("id")))
                    )
            );
            dataScope.select(scope.get("id")).where(scopeMatch);
            return cb.and(scoped, cb.or(cb.equal(root.get("assignedMentorId"), userId),
                    cb.exists(membership), cb.exists(staff), cb.exists(dataScope)));
        };
    }

    public static boolean hasRole(String roleName) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && auth.getPrincipal() instanceof UserPrincipal && auth.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equalsIgnoreCase("ROLE_" + roleName));
    }
}
