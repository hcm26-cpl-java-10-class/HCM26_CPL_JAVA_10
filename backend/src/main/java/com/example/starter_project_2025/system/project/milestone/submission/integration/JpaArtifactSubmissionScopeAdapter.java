package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Component
@Primary
@Profile("(!test & !milestone-mock) | artifact-real-scope")
@RequiredArgsConstructor
public class JpaArtifactSubmissionScopeAdapter
        implements ArtifactSubmissionScopePort {

    private final WorkspaceAccessService access;
    private final ProjectMemberRepository members;
    private final ProjectTeamRepository teams;

    @Override
    public void requireStudentTeamAccess(
            Long teamId, UUID actorId, Long tenantId) {

        User user = actor(actorId, tenantId);
        ProjectTeam team = access.requireTeam(user, teamId, false);

        if (!isAdministrator(user) && !currentStudent(user, team)) {
            throw denied();
        }
    }

    @Override
    public void requireStudentProjectAccess(
            Long projectId, UUID actorId, Long tenantId) {

        User user = actor(actorId, tenantId);
        access.requireProject(user, projectId, false);

        if (isAdministrator(user)) {
            return;
        }

        boolean assigned = teams
                .findAllByProject_IdInOrderByIdDesc(List.of(projectId))
                .stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive())
                        && team.getStatus() == ProjectTeamStatus.ACTIVE
                        && Objects.equals(
                        team.getTrainingClass().getTenantId(),
                        tenantId))
                .anyMatch(team -> currentStudent(user, team));

        if (!assigned) {
            throw denied();
        }
    }

    @Override
    public void requireReviewerTeamAccess(
            Long teamId, UUID actorId, Long tenantId) {

        User user = actor(actorId, tenantId);
        access.requireTeam(user, teamId, false);

        if (!access.permitted(user, "ARTIFACT_REVIEW")) {
            throw denied();
        }
    }

    private User actor(UUID actorId, Long tenantId) {
        User user = access.requireUser(false);
        access.requireTenant(user, false);

        UUID expectedActorId = UUID.nameUUIDFromBytes(
                user.getEmail().getBytes(StandardCharsets.UTF_8));

        if (!Objects.equals(user.getTenantId(), tenantId)
                || !expectedActorId.equals(actorId)) {
            throw denied();
        }

        return user;
    }

    private boolean currentStudent(User user, ProjectTeam team) {
        boolean student = user.getRoles().stream()
                .anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && "STUDENT".equals(role.getName()));

        if (!student) {
            return false;
        }

        return members
                .findByTeam_IdAndClassMember_User_Id(
                        team.getId(), user.getId())
                .filter(member ->
                        Boolean.TRUE.equals(member.getIsActive())
                                && Boolean.TRUE.equals(
                                member.getClassMember().getIsActive())
                                && member.getClassMember().getStatus()
                                == ClassMemberStatus.ACTIVE
                                && Objects.equals(
                                member.getClassMember()
                                        .getTrainingClass().getId(),
                                team.getTrainingClass().getId()))
                .isPresent();
    }

    private boolean isAdministrator(User user) {
        return user.getRoles().stream()
                .anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && Set.of(
                        "ADMIN",
                        "ADMINISTRATOR",
                        "SUPER_ADMIN",
                        "SYSTEM_ADMIN"
                ).contains(role.getName()));
    }

    private AccessDeniedException denied() {
        return new AccessDeniedException(
                "Artifact access is outside the current student/team scope");
    }
}