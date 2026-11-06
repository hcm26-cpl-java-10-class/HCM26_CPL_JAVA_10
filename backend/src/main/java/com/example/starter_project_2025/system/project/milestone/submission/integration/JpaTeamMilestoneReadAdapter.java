package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.milestone.integration.port.TeamMilestoneReadPort;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.Objects;
import java.util.Set;

@Component @Profile("!test | artifact-real-scope") @RequiredArgsConstructor
public class JpaTeamMilestoneReadAdapter implements TeamMilestoneReadPort {
    private final WorkspaceAccessService access;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final TenantRepository tenants;
    private final ScopeAuthorizationService classScope;

    @Override public Long requireTenant(Long teamId) {
        var user=access.requireUser(false);access.requireTenant(user,false);
        var team=teams.findById(teamId).filter(t->Boolean.TRUE.equals(t.getIsActive())&&t.getStatus()==ProjectTeamStatus.ACTIVE)
                .orElseThrow(()->new ResourceNotFoundException("Team not found"));
        var c=team.getTrainingClass();
        var tenant=tenants.findById(c.getTenantId()).orElseThrow(this::denied);
        if(!Boolean.TRUE.equals(tenant.getActive())||!Boolean.TRUE.equals(tenant.getIsActive())
                ||!Boolean.TRUE.equals(c.getIsActive()))throw denied();
        boolean admin=user.getRoles().stream().anyMatch(r->Boolean.TRUE.equals(r.getIsActive())
                &&Set.of("ADMIN","SUPER_ADMIN","SYSTEM_ADMIN").contains(r.getName()));
        boolean manages=classScope.canManageClass(SecurityContextHolder.getContext().getAuthentication(),c,
                "PEO_TEAM_ALLOCATE","PRJ_WORKSPACE_MANAGE");
        if(!Objects.equals(user.getTenantId(),c.getTenantId())
                &&!(admin&&manages&&(access.permitted(user,"PEO_TEAM_ALLOCATE")||access.permitted(user,"PRJ_WORKSPACE_MANAGE"))))throw denied();
        boolean current=members.findByTeam_IdAndClassMember_User_Id(teamId,user.getId()).filter(m->Boolean.TRUE.equals(m.getIsActive())
                &&Boolean.TRUE.equals(m.getClassMember().getIsActive())&&m.getClassMember().getStatus()==ClassMemberStatus.ACTIVE
                &&c.getId().equals(m.getClassMember().getTrainingClass().getId())).isPresent();
        if(!admin&&!manages&&!current&&!Objects.equals(team.getAssignedMentorId(),user.getId())&&!Objects.equals(c.getMentorId(),user.getId()))throw denied();
        return tenant.getId();
    }
    private AccessDeniedException denied(){return new AccessDeniedException("This team is outside your milestone data scope");}
}
