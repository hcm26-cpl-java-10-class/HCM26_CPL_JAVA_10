package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Set;

/**
 * Data-scope guard of project learning resources (US-RES-004 / AC04).
 * <p>
 * Teachers, administrators and program owners keep tenant-wide access. Every
 * other caller (a trainee) may only read the resources of a project that
 * belongs to a team they are an active member or the assigned mentor of.
 * Calls outside that scope are rejected with HTTP 403 before any resource row
 * is returned.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectResourceAccessGuard {

    private static final Set<String> PRIVILEGED_AUTHORITIES = Set.of(
            "ROLE_ADMIN", "ROLE_SUPER_ADMIN", "ROLE_PO", "ROLE_TEACHER"
    );

    ProjectTeamRepository projectTeams;
    ProjectMemberRepository projectMembers;

    public boolean isPrivileged() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        return authentication != null && authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(PRIVILEGED_AUTHORITIES::contains);
    }

    public boolean canAccessProject(Long projectId) {

        if (projectId == null) {
            return false;
        }

        if (isPrivileged()) {
            return true;
        }

        UserPrincipal principal = requirePrincipal();
        Long userId = principal.getUser().getId();

        return projectTeams.findAllByProject_IdInOrderByIdDesc(List.of(projectId)).stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()))
                .anyMatch(team -> isMemberOrMentor(team, userId));
    }

    public void requireProject(Long projectId) {

        if (!canAccessProject(projectId)) {
            throw new AccessDeniedException(
                    "These project resources are outside your team data scope");
        }
    }

    /** Projects the caller may read; empty for privileged roles (all allowed). */
    public List<Long> accessibleProjectIds() {

        UserPrincipal principal = requirePrincipal();
        Long userId = principal.getUser().getId();
        Long tenantId = principal.getTenantId();

        if (tenantId == null) {
            return List.of();
        }

        return projectTeams.findAllByTrainingClass_TenantIdOrderByIdAsc(tenantId).stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()))
                .filter(team -> team.getProjectId() != null)
                .filter(team -> isMemberOrMentor(team, userId))
                .map(ProjectTeam::getProjectId)
                .distinct()
                .toList();
    }

    private boolean isMemberOrMentor(ProjectTeam team, Long userId) {

        return userId.equals(team.getAssignedMentorId())
                || projectMembers.existsByTeam_IdAndClassMember_User_IdAndClassMember_Status(
                        team.getId(), userId, ClassMemberStatus.ACTIVE);
    }

    private UserPrincipal requirePrincipal() {

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication != null && authentication.getPrincipal() instanceof UserPrincipal principal) {
            return principal;
        }

        throw new AccessDeniedException("Authentication is required");
    }
}
