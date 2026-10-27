package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.UUID;

/** Uses the authenticated user and persisted team membership instead of configured demo IDs. */
@Component
@Profile("!milestone-mock & !test")
@RequiredArgsConstructor
public class JpaArtifactSubmissionScopeAdapter implements ArtifactSubmissionScopePort {

    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;

    @Override
    public void requireStudentProjectAccess(Long projectId, UUID actorId, Long tenantId) {
        var principal = requirePrincipal(tenantId);
        projects.findById(projectId)
                .filter(project -> project.getTenant() != null
                        && tenantId.equals(project.getTenant().getId())
                        && Boolean.TRUE.equals(project.getIsActive()))
                .orElseThrow(() -> new AccessDeniedException("Project is outside the current tenant"));
        if (isAdministrator()) return;

        boolean assigned = teams.findAllByProject_IdInOrderByIdDesc(java.util.List.of(projectId)).stream()
                .anyMatch(team -> members.existsByTeam_IdAndClassMember_User_IdAndClassMember_Status(
                        team.getId(), principal.getUser().getId(), ClassMemberStatus.ACTIVE));
        if (!assigned) throw new AccessDeniedException("Student is not assigned to this project");
    }

    @Override
    public void requireStudentTeamAccess(Long teamId, UUID actorId, Long tenantId) {
        var principal = requirePrincipal(tenantId);
        teams.findByIdAndTrainingClass_TenantId(teamId, tenantId)
                .orElseThrow(() -> new AccessDeniedException("Team is outside the current tenant"));
        if (isAdministrator()) return;
        if (!members.existsByTeam_IdAndClassMember_User_IdAndClassMember_Status(
                teamId, principal.getUser().getId(), ClassMemberStatus.ACTIVE)) {
            throw new AccessDeniedException("Student is not assigned to this team");
        }
    }

    private UserPrincipal requirePrincipal(Long tenantId) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                || principal.getTenantId() == null || !tenantId.equals(principal.getTenantId())) {
            throw new AccessDeniedException("Authenticated tenant scope is required");
        }
        return principal;
    }

    private boolean isAdministrator() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())
                        || "ROLE_SUPER_ADMIN".equals(authority.getAuthority())
                        || "ROLE_ADMINISTRATOR".equals(authority.getAuthority()));
    }
}
