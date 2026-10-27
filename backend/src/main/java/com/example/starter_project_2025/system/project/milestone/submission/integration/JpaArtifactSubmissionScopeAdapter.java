package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.*;
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
import java.util.*;

/** Real workspace roster is authoritative; old mock-only tests retain their explicit fixtures. */
@Component @Primary @Profile("!test | artifact-real-scope") @RequiredArgsConstructor
public class JpaArtifactSubmissionScopeAdapter implements ArtifactSubmissionScopePort {
    private final WorkspaceAccessService access;
    private final ProjectMemberRepository members;
    private final ProjectTeamRepository teams;

    private User actor(UUID actorId,Long tenantId) {
        User user=access.requireUser(false);
        access.requireTenant(user,false);
        if(!Objects.equals(user.getTenantId(),tenantId)
                ||!UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)).equals(actorId))throw denied();
        return user;
    }
    private boolean currentStudent(User user,ProjectTeam team) {
        if(user.getRoles().stream().noneMatch(role->Boolean.TRUE.equals(role.getIsActive())&&"STUDENT".equals(role.getName())))return false;
        return members.findByTeam_IdAndClassMember_User_Id(team.getId(),user.getId())
                .filter(row->Boolean.TRUE.equals(row.getIsActive())&&Boolean.TRUE.equals(row.getClassMember().getIsActive())
                        &&row.getClassMember().getStatus()==ClassMemberStatus.ACTIVE
                        &&Objects.equals(row.getClassMember().getTrainingClass().getId(),team.getTrainingClass().getId())).isPresent();
    }
    @Override public void requireStudentTeamAccess(Long teamId,UUID actorId,Long tenantId) {
        User user=actor(actorId,tenantId);ProjectTeam team=access.requireTeam(user,teamId,false);
        if(!currentStudent(user,team))throw denied();
    }
    @Override public void requireStudentProjectAccess(Long projectId,UUID actorId,Long tenantId) {
        User user=actor(actorId,tenantId);access.requireProject(user,projectId,false);
        if(teams.findAllByProject_IdInOrderByIdDesc(List.of(projectId)).stream()
                .filter(team->Boolean.TRUE.equals(team.getIsActive())&&team.getStatus()==ProjectTeamStatus.ACTIVE
                        &&Objects.equals(team.getTrainingClass().getTenantId(),tenantId))
                .noneMatch(team->currentStudent(user,team)))throw denied();
    }
    @Override public void requireReviewerTeamAccess(Long teamId,UUID actorId,Long tenantId) {
        User user=actor(actorId,tenantId);access.requireTeam(user,teamId,false);
        if(!access.permitted(user,"ARTIFACT_REVIEW"))throw denied();
    }
    private AccessDeniedException denied() {return new AccessDeniedException("Artifact access is outside the current student/team scope");}
}
