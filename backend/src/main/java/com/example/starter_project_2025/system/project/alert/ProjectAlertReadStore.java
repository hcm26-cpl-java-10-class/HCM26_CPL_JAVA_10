package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.activity.ProjectActivityLog;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditLog;
import jakarta.persistence.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.*;

@Repository @RequiredArgsConstructor
public class ProjectAlertReadStore {
    private final EntityManager em;
    private final ProjectAlertAccess access;
    public record Scope(Map<Long,ProjectTeam> teams,Map<Long,ProjectMember> members,List<SprintBacklog> items) { }
    public Scope load(List<ProjectTeam> teams) {
        Map<Long,ProjectTeam> byTeam=new LinkedHashMap<>();teams.forEach(team->byTeam.put(team.getId(),team));
        if(teams.isEmpty())return new Scope(byTeam,Map.of(),List.of());
        List<ProjectMember> memberships=em.createQuery("select m from ProjectMember m join fetch m.team t " +
                "join fetch m.classMember cm join fetch cm.user where t.id in :teams",ProjectMember.class)
                .setParameter("teams",byTeam.keySet()).getResultList();
        Map<Long,ProjectMember> byMember=new LinkedHashMap<>();
        memberships.stream().filter(access::current).forEach(m->byMember.put(m.getId(),m));
        List<Long> projects=teams.stream().map(ProjectTeam::getProjectId).filter(Objects::nonNull).toList();
        var items=em.createQuery("select b from SprintBacklog b left join fetch b.sprint s where b.isActive=true and " +
                "(s.teamId in :teams or (s.teamId is null and s.projectId in :projects) " +
                "or (b.sprint is null and b.assigneeProjectMemberId in :members))",SprintBacklog.class)
                .setParameter("teams",byTeam.keySet()).setParameter("projects",nonempty(projects))
                .setParameter("members",nonempty(byMember.keySet())).getResultList();
        Scope scope=new Scope(byTeam,byMember,items);
        return new Scope(byTeam,byMember,items.stream().filter(item->owner(scope,item)!=null).toList());
    }
    public ProjectTeam owner(Scope scope,SprintBacklog item) {
        Sprint sprint=item.getSprint();
        if(sprint!=null) {
            if(!Boolean.TRUE.equals(sprint.getIsActive()))return null;
            if(sprint.getTeamId()!=null) {
                ProjectTeam team=scope.teams().get(sprint.getTeamId());
                return team!=null&&matchesProject(team,sprint.getProjectId())?team:null;
            }
            if(sprint.getProjectId()!=null)return scope.teams().values().stream()
                    .filter(team->sprint.getProjectId().equals(team.getProjectId())).findFirst().orElse(null);
            return null;
        }
        ProjectMember assignee=scope.members().get(item.getAssigneeProjectMemberId());
        return assignee==null?null:scope.teams().get(assignee.getTeam().getId());
    }
    public ProjectMember assignee(Scope scope,SprintBacklog item) {
        var owner=owner(scope,item);var member=scope.members().get(item.getAssigneeProjectMemberId());
        return owner!=null&&member!=null&&owner.getId().equals(member.getTeam().getId())?member:null;
    }
    public List<Milestone> milestones(Map<Long,ProjectTeam> teams) {
        if(teams.isEmpty())return List.of();
        return em.createQuery("select m from Milestone m where m.teamId in :teams and m.active=true",Milestone.class)
                .setParameter("teams",teams.keySet()).getResultList().stream()
                .filter(m->Objects.equals(m.getTenantId(),teams.get(m.getTeamId()).getTrainingClass().getTenantId())
                        &&matchesProject(teams.get(m.getTeamId()),m.getProjectId())).toList();
    }
    public List<SprintBacklog> lockItems(Collection<Long> ids) {
        return em.createQuery("select b from SprintBacklog b where b.id in :ids order by b.id",SprintBacklog.class)
                .setParameter("ids",ids).setLockMode(LockModeType.PESSIMISTIC_WRITE).getResultList();
    }
    public List<ProjectActivityLog> taskContributions(Long projectId,Set<Long> actors,LocalDateTime now) {
        if(projectId==null||actors.isEmpty())return List.of();
        return em.createQuery("select a from ProjectActivityLog a where a.projectId=:project and a.actorId in :actors " +
                "and a.occurredAt<=:now and a.actionType in :actions",ProjectActivityLog.class)
                .setParameter("project",projectId).setParameter("actors",actors).setParameter("now",now)
                .setParameter("actions",List.of("TASK_CREATED","TASK_UPDATED","TASK_STATUS_CHANGED")).getResultList();
    }
    public List<TaskAuditLog> uuidTaskContributions(ProjectTeam team,Set<Long> actors,LocalDateTime now) {
        if(team.getProjectId()==null||actors.isEmpty())return List.of();
        return em.createQuery("select a from TaskAuditLog a,TaskAlertProjectLink bridge where a.projectId=bridge.id "
                +"and bridge.projectId=:project and bridge.tenantId=:tenant and a.actorId in :actors and a.occurredAt<=:now "
                +"and a.action in ('CREATE','UPDATE','STATUS_CHANGED')",TaskAuditLog.class)
                .setParameter("project",team.getProjectId()).setParameter("tenant",team.getTrainingClass().getTenantId())
                .setParameter("actors",actors).setParameter("now",now).getResultList();
    }
    public List<SprintBacklogAuditLog> backlogContributions(ProjectTeam team,Set<Long> actors,Collection<Long> itemIds,LocalDateTime now) {
        if(actors.isEmpty())return List.of();
        var sprints=em.createQuery("select s.id from Sprint s where "
                +"(s.teamId=:team and (s.projectId is null or s.projectId=:project)) "
                +"or (s.teamId is null and s.projectId=:project)",Long.class)
                .setParameter("team",team.getId()).setParameter("project",team.getProjectId()).getResultList();
        return em.createQuery("select a from BacklogItemAuditLog a where a.actorId in :actors and a.createdAt<=:now " +
                "and a.action in ('CREATE','UPDATE') and (a.sprintId in :sprints or a.sprintBacklogId in :items)",SprintBacklogAuditLog.class)
                .setParameter("actors",actors).setParameter("now",now).setParameter("sprints",nonempty(sprints))
                .setParameter("items",nonempty(itemIds)).getResultList();
    }
    public List<ProjectTeamMemberHistory> joins(Long teamId) {
        return em.createQuery("select h from ProjectTeamMemberHistory h where h.toTeamId=:team " +
                "and h.action in ('MEMBER_ADDED','MEMBER_TRANSFERRED','MEMBER_SWAPPED')",ProjectTeamMemberHistory.class)
                .setParameter("team",teamId).getResultList();
    }
    private Collection<Long> nonempty(Collection<Long> values) {return values.isEmpty()?List.of(-1L):values;}
    private boolean matchesProject(ProjectTeam team,Long projectId) {
        // Team-scoped records are valid before/after a project is attached.
        // An explicit project reference must agree with the team's current project.
        return projectId==null||Objects.equals(projectId,team.getProjectId());
    }
}
