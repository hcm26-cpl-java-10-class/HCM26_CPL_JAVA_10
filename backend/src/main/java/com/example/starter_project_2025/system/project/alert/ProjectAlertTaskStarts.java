package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertData;
import com.fasterxml.jackson.databind.*;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.time.*;
import java.util.*;

/** Actual task starts and the age of current Todo assignments, across the task stores. */
@Component @RequiredArgsConstructor
public class ProjectAlertTaskStarts {
    private final EntityManager em;
    private final ProjectAlertReadStore store;
    private final ObjectMapper json;
    public record Work(Map<Long,Instant> todoSince,Map<Long,Instant> lastStarted) { }
    private record History(String id,Long actor,String before,String after,Instant at) { }
    private record Pending(String id,Long user,String assignee,Instant created) { }

    public Work load(ProjectTeam team,ProjectAlertReadStore.Scope scope,Set<Long> actors,Instant now,ZoneId zone) {
        Map<Long,Instant> todo=new HashMap<>(),started=new HashMap<>();
        LocalDateTime localNow=LocalDateTime.ofInstant(now,zone);
        var items=scope.items().stream().filter(item->team.getId().equals(store.owner(scope,item).getId())).toList();
        var backlogHistory=store.backlogContributions(team,actors,items.stream().map(item->item.getId()).toList(),localNow).stream()
                .map(a->new History(a.getSprintBacklogId().toString(),a.getActorId(),a.getBeforeState(),a.getAfterState(),at(a.getCreatedAt(),zone))).toList();
        var pending=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.TODO)
                .filter(item->store.assignee(scope,item)!=null)
                .map(item->new Pending(item.getId().toString(),store.assignee(scope,item).getClassMember().getUser().getId(),
                        item.getAssigneeProjectMemberId().toString(),at(item.getCreatedAt(),zone))).toList();
        // Assignment events may have been written by a mentor; do not restrict them to student actors.
        var assignmentHistory=items.isEmpty()?List.<History>of():em.createQuery("select a from BacklogItemAuditLog a "
                        +"where a.sprintBacklogId in :ids and a.createdAt<=:now",com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog.class)
                .setParameter("ids",items.stream().map(item->item.getId()).toList()).setParameter("now",localNow).getResultList().stream()
                .map(a->new History(a.getSprintBacklogId().toString(),a.getActorId(),a.getBeforeState(),a.getAfterState(),at(a.getCreatedAt(),zone))).toList();
        collect(pending,assignmentHistory,backlogHistory,todo,started,actors,now);

        var board=em.createQuery("select t from Task t where t.isActive=true and "
                        +"(t.teamId=:team or (t.teamId is null and t.projectId=:project))",com.example.starter_project_2025.system.project.sprint.Task.class)
                .setParameter("team",team.getId()).setParameter("project",team.getProjectId()).getResultList().stream()
                .filter(t->t.getProjectId()==null||Objects.equals(t.getProjectId(),team.getProjectId())).toList();
        Map<Long,Long> boardUsers=new HashMap<>();
        if(team.getProjectId()!=null)em.createQuery("select m from BoardProjectMember m where m.projectId=:project and m.isActive=true",BoardProjectMember.class)
                .setParameter("project",team.getProjectId()).getResultList().forEach(m->boardUsers.put(m.getId(),m.getUserId()));
        var boardPending=new ArrayList<Pending>();
        for(var task:board)if(task.getStatus()==com.example.starter_project_2025.system.project.sprint.TaskStatus.TODO) {
            var member=scope.members().get(task.getAssigneeProjectMemberId());
            Long user=task.getTeamId()!=null?(member!=null&&team.getId().equals(member.getTeam().getId())?member.getClassMember().getUser().getId():null)
                    :boardUsers.get(task.getAssigneeProjectMemberId());
            if(user!=null)boardPending.add(new Pending(task.getId().toString(),user,task.getAssigneeProjectMemberId().toString(),at(task.getCreatedAt(),zone)));
        }
        // Keep all actors for reassignment timestamps, but credit starts only to the student who performed them.
        var boardHistory=team.getProjectId()==null?List.<History>of():em.createQuery("select a from ProjectActivityLog a "
                        +"where a.projectId=:project and a.entityType='TASK' and a.occurredAt<=:now",com.example.starter_project_2025.system.project.activity.ProjectActivityLog.class)
                .setParameter("project",team.getProjectId()).setParameter("now",localNow).getResultList().stream()
                .filter(a->a.getEntityId()!=null&&board.stream().anyMatch(t->t.getId().equals(a.getEntityId())))
                .map(a->new History(a.getEntityId().toString(),a.getActorId(),a.getBeforeState(),a.getAfterState(),at(a.getOccurredAt(),zone))).toList();
        collect(boardPending,boardHistory,boardHistory,todo,started,actors,now);

        if(team.getProjectId()!=null) {
            var aliases=em.createQuery("select m from TaskAlertMemberLink m,TaskAlertProjectLink p where m.projectId=p.id "
                            +"and p.projectId=:project and p.tenantId=:tenant and m.source=:source",TaskAlertData.MemberLink.class)
                    .setParameter("project",team.getProjectId()).setParameter("tenant",team.getTrainingClass().getTenantId())
                    .setParameter("source",TaskAlertData.MemberSource.PROJECT_MEMBER).getResultList();
            Map<UUID,Long> uuidUsers=new HashMap<>();
            for(var alias:aliases) {
                var member=scope.members().get(alias.getSourceMemberId());
                if(member!=null&&team.getId().equals(member.getTeam().getId()))uuidUsers.put(alias.getId(),member.getClassMember().getUser().getId());
            }
            {
                var uuidTasks=em.createQuery("select t from ProjectTask t,TaskAlertProjectLink p where t.projectId=p.id "
                                +"and p.projectId=:project and p.tenantId=:tenant and t.isActive=true",
                                com.example.starter_project_2025.system.project.task.Task.class)
                        .setParameter("project",team.getProjectId()).setParameter("tenant",team.getTrainingClass().getTenantId())
                        .getResultList();
                var uuidHistory=em.createQuery("select a from TaskAuditLog a,TaskAlertProjectLink p where a.projectId=p.id "
                                +"and p.projectId=:project and p.tenantId=:tenant and a.occurredAt<=:now",com.example.starter_project_2025.system.project.task.audit.TaskAuditLog.class)
                        .setParameter("project",team.getProjectId()).setParameter("tenant",team.getTrainingClass().getTenantId()).setParameter("now",localNow).getResultList().stream()
                        .filter(a->uuidTasks.stream().anyMatch(t->t.getId().equals(a.getTaskId())))
                        .map(a->new History(a.getTaskId().toString(),a.getActorId(),a.getBeforeState(),a.getAfterState(),at(a.getOccurredAt(),zone))).toList();
                var uuidPending=uuidTasks.stream().filter(t->uuidUsers.containsKey(t.getAssigneeProjectMemberId()))
                        .filter(t->t.getStatus()==com.example.starter_project_2025.system.project.task.TaskStatus.TODO)
                        .map(t->new Pending(t.getId().toString(),uuidUsers.get(t.getAssigneeProjectMemberId()),t.getAssigneeProjectMemberId().toString(),at(t.getCreatedAt(),zone))).toList();
                collect(uuidPending,uuidHistory,uuidHistory,todo,started,actors,now);
            }
        }
        return new Work(Map.copyOf(todo),Map.copyOf(started));
    }
    private void collect(List<Pending> pending,List<History> assignments,List<History> starts,
                         Map<Long,Instant> todo,Map<Long,Instant> started,Set<Long> actors,Instant now) {
        for(var work:pending) {
            if(!actors.contains(work.user()))continue;
            Instant since=work.created()==null?now:work.created();
            for(var event:assignments)if(work.id().equals(event.id())&&event.at()!=null&&event.at().isAfter(since)
                    &&work.assignee().equals(field(event.after(),"assigneeProjectMemberId"))
                    &&!Objects.equals(field(event.before(),"assigneeProjectMemberId"),field(event.after(),"assigneeProjectMemberId")))since=event.at();
            if(!since.isAfter(now))todo.merge(work.user(),since,(a,b)->a.isBefore(b)?a:b);
        }
        for(var event:starts)if(event.actor()!=null&&actors.contains(event.actor())&&event.at()!=null
                &&!event.at().isAfter(now)&&"IN_PROGRESS".equals(field(event.after(),"status"))
                &&field(event.before(),"status")!=null&&!"IN_PROGRESS".equals(field(event.before(),"status")))
            started.merge(event.actor(),event.at(),(a,b)->a.isAfter(b)?a:b);
    }
    private String field(String state,String key) {
        if(state==null)return null;
        try {var node=json.readTree(state);if(node.isObject()){var value=node.get(key);return value==null||value.isNull()?null:value.asText();}
            return "status".equals(key)?node.asText():null;
        } catch(Exception legacy) {return "status".equals(key)&&Set.of("TODO","IN_PROGRESS","REVIEW","DONE").contains(state)?state:null;}
    }
    private Instant at(LocalDateTime date,ZoneId zone) {return date==null?null:date.atZone(zone).toInstant();}
}
