package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.trainingclass.*;
import com.example.starter_project_2025.system.rbac.user.*;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;

@Service @RequiredArgsConstructor
public class ProjectAlertAccess {
    private final UserRepository users;
    private final TenantRepository tenants;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final TrainingClassRepository classes;
    private final ClassMemberRepository classMembers;
    private final ScopeAuthorizationService classScope;
    public User actor() {
        var auth=SecurityContextHolder.getContext().getAuthentication();
        if(auth==null || !(auth.getPrincipal() instanceof UserPrincipal principal))
            throw new AuthenticationCredentialsNotFoundException("Please sign in again");
        User user=users.findById(principal.getUser().getId()).orElseThrow(()->new AuthenticationCredentialsNotFoundException("Please sign in again"));
        if(!active(user)||user.getTenantId()==null)throw denied();
        var tenant=tenants.findById(user.getTenantId()).orElseThrow(this::denied);
        if(!Boolean.TRUE.equals(tenant.getIsActive())||!Boolean.TRUE.equals(tenant.getActive()))throw denied();
        require(user,"PROJECT_ALERT_READ");
        return user;
    }
    public boolean has(User user,String permission) {
        return user.getRoles().stream().filter(role->Boolean.TRUE.equals(role.getIsActive()))
                .flatMap(role->role.getPermissions().stream()).anyMatch(p->Boolean.TRUE.equals(p.getIsActive())&&permission.equals(p.getName()));
    }
    public void require(User user,String permission) {if(!has(user,permission))throw denied();}
    public String readPermission(Kind kind) {return switch(kind){case BACKLOG->"SPRINT_BACKLOG_READ";case MILESTONE->"MILESTONE_READ";case INACTIVE->"INACTIVE_MEMBER_READ";};}
    public String sendPermission(Kind kind) {return switch(kind){case BACKLOG->"TASK_ALERT_SEND";case MILESTONE->"MILESTONE_ALERT_SEND";case INACTIVE->"INACTIVE_MEMBER_SEND";};}
    public boolean active(User user) {return Boolean.TRUE.equals(user.getIsActive())&&!Boolean.TRUE.equals(user.getLocked());}
    public boolean current(ProjectMember member) {
        return Boolean.TRUE.equals(member.getIsActive())&&Boolean.TRUE.equals(member.getClassMember().getIsActive())
                &&member.getClassMember().getStatus()==ClassMemberStatus.ACTIVE&&Boolean.TRUE.equals(member.getClassMember().getUser().getIsActive())
                &&member.getTeam().getTrainingClass().getId().equals(member.getClassMember().getTrainingClass().getId())
                &&Objects.equals(member.getClassMember().getUser().getTenantId(),member.getTeam().getTrainingClass().getTenantId());
    }
    public boolean admin(User user) {
        return user.getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                &&Set.of("ADMIN","ADMINISTRATOR","SYSTEM_ADMIN","SUPER_ADMIN").contains(role.getName()));
    }
    public List<ProjectTeam> allowed(User actor) {
        return teams.findAll().stream()
                .filter(team->Boolean.TRUE.equals(team.getIsActive())&&team.getStatus()==ProjectTeamStatus.ACTIVE)
                .filter(team->Boolean.TRUE.equals(team.getTrainingClass().getIsActive())
                        &&team.getTrainingClass().getStatus()!=TrainingClassStatus.CANCELLED
                        &&team.getTrainingClass().getStatus()!=TrainingClassStatus.COMPLETED)
                .filter(team->classTenantAllowed(actor,team.getTrainingClass()))
                .filter(team->team.getProject()==null || Boolean.TRUE.equals(team.getProject().getIsActive())
                        &&Objects.equals(team.getProject().getTenantId(),team.getTrainingClass().getTenantId()))
                .filter(team->admin(actor)||Objects.equals(team.getAssignedMentorId(),actor.getId())
                        ||Objects.equals(team.getTrainingClass().getMentorId(),actor.getId())
                        ||members.findByTeam_IdAndClassMember_User_Id(team.getId(),actor.getId())
                        .filter(this::current).filter(member->member.getRole()!=null&&Set.of("PM","TEAM_LEADER","TEAM_LEAD").contains(member.getRole())).isPresent())
                .toList();
    }
    private boolean classTenantAllowed(User actor,TrainingClass trainingClass) {
        var tenant=tenants.findById(trainingClass.getTenantId()).orElse(null);
        if(tenant==null||!Boolean.TRUE.equals(tenant.getActive())||!Boolean.TRUE.equals(tenant.getIsActive()))return false;
        return Objects.equals(actor.getTenantId(),trainingClass.getTenantId()) || admin(actor)
                &&(has(actor,"PEO_TEAM_ALLOCATE")||has(actor,"PRJ_WORKSPACE_MANAGE"))
                &&classScope.canManageClass(SecurityContextHolder.getContext().getAuthentication(),trainingClass,
                    "PEO_TEAM_ALLOCATE","PRJ_WORKSPACE_MANAGE");
    }
    public List<ClassInfo> classOptions(User actor,List<ProjectTeam> allowedTeams) {
        Set<Long> teamClasses=new HashSet<>();allowedTeams.forEach(team->teamClasses.add(team.getTrainingClass().getId()));
        return classes.findAll().stream().filter(c->Boolean.TRUE.equals(c.getIsActive())
                        &&c.getStatus()!=TrainingClassStatus.CANCELLED&&c.getStatus()!=TrainingClassStatus.COMPLETED)
                .filter(c->classTenantAllowed(actor,c)&&(admin(actor)||teamClasses.contains(c.getId())
                        ||Objects.equals(c.getMentorId(),actor.getId())))
                .map(c->new ClassInfo(c.getId(),c.getCode(),c.getName(),c.getProgramId(),c.getProgramName(),
                        c.getCohortId(),c.getCohortName(),classMembers.findAllByTrainingClass_IdAndStatusOrderByIdAsc(c.getId(),ClassMemberStatus.ACTIVE)
                        .stream().filter(cm->Boolean.TRUE.equals(cm.getIsActive())&&Boolean.TRUE.equals(cm.getUser().getIsActive())
                                &&Objects.equals(cm.getUser().getTenantId(),c.getTenantId()))
                        .filter(cm->cm.getUser().getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                                &&Set.of("STUDENT","TRAINEE").contains(role.getName()))).count(),
                        allowedTeams.stream().filter(team->c.getId().equals(team.getTrainingClass().getId())).count()))
                .sorted(Comparator.comparing(ClassInfo::name).thenComparing(ClassInfo::id)).toList();
    }
    public ProjectTeam team(User actor,Long id) {
        return allowed(actor).stream().filter(team->team.getId().equals(id)).findFirst().orElseThrow(this::denied);
    }
    public boolean monitoring(ProjectTeam team) {
        return team.getProject()==null || !Set.of(
                com.example.starter_project_2025.system.project.domain.ProjectStatus.COMPLETED,
                com.example.starter_project_2025.system.project.domain.ProjectStatus.CANCELLED).contains(team.getProject().getStatus());
    }
    public void requireMonitoring(ProjectTeam team) {
        if (!monitoring(team)) throw new com.example.starter_project_2025.system.project.task.TaskConflictException(
                "This project is completed or cancelled. New alerts and milestone work-item changes are no longer allowed.");
    }
    public List<ProjectTeam> filter(User actor,Filter filter) {
        if(filter.windowHours()<1||filter.windowHours()>720||filter.page()<0||filter.size()<1||filter.size()>200)
            throw new TaskValidationException("filters","Use a 1–720 hour window, a non-negative page and a size from 1 to 200");
        for(Long id:Arrays.asList(filter.programId(),filter.cohortId(),filter.classId(),filter.teamId()))
            if(id!=null&&id<=0)throw new TaskValidationException("filters","Filter IDs must be positive");
        var allowed=allowed(actor);
        if(filter.teamId()!=null&&allowed.stream().noneMatch(team->team.getId().equals(filter.teamId())))throw denied();
        if(filter.classId()!=null&&classOptions(actor,allowed).stream().noneMatch(c->c.id().equals(filter.classId())))throw denied();
        String search=filter.teamSearch()==null?"":filter.teamSearch().strip().toLowerCase(Locale.ROOT);
        if(search.length()>120)throw new TaskValidationException("teamSearch","Team search cannot exceed 120 characters");
        if(!Set.of("ALL","UPCOMING","OVERDUE").contains(filter.deadlineStatus()))throw new TaskValidationException("deadlineStatus","Unknown deadline filter");
        return allowed.stream().filter(team->{var c=team.getTrainingClass();return
                (filter.programId()==null||filter.programId().equals(c.getProgramId()))
                &&(filter.cohortId()==null||filter.cohortId().equals(c.getCohortId()))
                &&(filter.classId()==null||filter.classId().equals(c.getId()))
                &&(filter.teamId()==null||filter.teamId().equals(team.getId()))
                &&(search.isEmpty()||team.getTeamName().toLowerCase(Locale.ROOT).contains(search)||team.getCode().toLowerCase(Locale.ROOT).contains(search));}).toList();
    }
    public TeamInfo describe(ProjectTeam team) {
        var c=team.getTrainingClass();var p=team.getProject();
        return new TeamInfo(team.getId(),team.getCode(),team.getTeamName(),c.getId(),c.getCode(),c.getName(),
                c.getProgramId(),c.getProgramName(),c.getCohortId(),c.getCohortName(),p==null?null:p.getId(),p==null?null:p.getName(),
                p==null?null:p.getStatus().name());
    }
    private AccessDeniedException denied() {return new AccessDeniedException("Your access to this class or team is unavailable or has changed");}
}
