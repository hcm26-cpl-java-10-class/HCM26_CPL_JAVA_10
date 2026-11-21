package com.example.starter_project_2025.system.git_integration.contributor;

import com.example.starter_project_2025.system.git_integration.repository.GitProjectMembershipRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitProjectMembershipRepository.MemberRow;
import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * GI-06: the members of a master project and its modules (BR7): active members of the active
 * teams working on a project of the scope, directly or through a module assignment.
 */
@Component
@RequiredArgsConstructor
public class GitProjectMembership {

    public static final String PM = ProjectMemberRole.PM.name();

    private final GitProjectMembershipRepository memberships;

    /** One person, with every team role and project of the scope they work on. */
    public record Member(Long userId, String name, String email, Set<String> roles, Set<Long> projectIds) {
        public boolean isPm() {
            return roles.contains(PM);
        }
    }

    /** Members of the scope, by name. */
    public List<Member> members(Set<Long> scope) {
        if (scope.isEmpty()) return List.of();
        Map<Long, Member> byUser = new LinkedHashMap<>();
        Stream.concat(
                memberships.membersOfTeamProjects(scope, ClassMemberStatus.ACTIVE, ProjectTeamStatus.ACTIVE).stream(),
                memberships.membersOfAssignedTeams(scope, ClassMemberStatus.ACTIVE, ProjectTeamStatus.ACTIVE).stream())
                .forEach(row -> {
                    Member member = byUser.computeIfAbsent(row.getUserId(), id -> new Member(id, fullName(row),
                            row.getEmail(), new LinkedHashSet<>(), new LinkedHashSet<>()));
                    member.roles().addAll(ProjectMemberRole.parseRoles(row.getRole()));
                    if (row.getProjectId() != null) member.projectIds().add(row.getProjectId());
                });
        List<Member> sorted = new ArrayList<>(byUser.values());
        sorted.sort(Comparator.comparing((Member m) -> ContributorIdentity.normalizeName(m.name())).thenComparing(Member::userId));
        return sorted;
    }

    public boolean isMentor(Long userId, Set<Long> scope) {
        return !scope.isEmpty() && memberships.isMentorOfScope(userId, scope, ProjectTeamStatus.ACTIVE);
    }

    private static String fullName(MemberRow row) {
        String first = row.getFirstName() == null ? "" : row.getFirstName().trim();
        String last = row.getLastName() == null ? "" : row.getLastName().trim();
        String name = (first + " " + last).trim();
        return name.isEmpty() ? row.getEmail() : name;
    }
}
