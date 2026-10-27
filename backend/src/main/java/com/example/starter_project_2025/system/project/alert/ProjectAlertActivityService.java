package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;

@Slf4j @Service @RequiredArgsConstructor
public class ProjectAlertActivityService {
    private final ProjectAlertReadStore store;
    private final ProjectAlertAccess access;
    private final AlertExternalContributions external;
    private final MemberReminderSettings settings;
    private final ProjectAlertRecipientRepository recipients;
    private final ProjectAlertArtifactReadStore artifacts;
    public List<MemberRow> members(ProjectTeam team,ProjectAlertReadStore.Scope scope,Instant now) {
        Map<Long,ProjectMember> users=new LinkedHashMap<>();
        scope.members().values().stream().filter(m->team.getId().equals(m.getTeam().getId()))
                .filter(m->m.getClassMember().getUser().getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                        &&Set.of("STUDENT","TRAINEE").contains(role.getName())))
                .forEach(m->users.put(m.getClassMember().getUser().getId(),m));
        if(users.isEmpty())return List.of();
        LocalDateTime localNow=LocalDateTime.ofInstant(now,settings.auditZone());
        Map<Long,Instant> latest=new HashMap<>();
        store.taskContributions(team.getProjectId(),users.keySet(),localNow).stream()
                .filter(a->"TASK_CREATED".equals(a.getActionType())||!Objects.equals(a.getBeforeState(),a.getAfterState()))
                .forEach(a->merge(latest,a.getActorId(),a.getOccurredAt().atZone(settings.auditZone()).toInstant(),now));
        store.uuidTaskContributions(team,users.keySet(),localNow).stream()
                .filter(a->"CREATE".equals(a.getAction())||!Objects.equals(a.getBeforeState(),a.getAfterState()))
                .forEach(a->merge(latest,a.getActorId(),a.getOccurredAt().atZone(settings.auditZone()).toInstant(),now));
        var ids=scope.items().stream().filter(item->team.getId().equals(store.owner(scope,item).getId())).map(item->item.getId()).toList();
        store.backlogContributions(team,users.keySet(),ids,localNow).stream()
                .filter(a->"CREATE".equals(a.getAction())||!Objects.equals(a.getBeforeState(),a.getAfterState()))
                .forEach(a->merge(latest,a.getActorId(),a.getCreatedAt().atZone(settings.auditZone()).toInstant(),now));
        artifacts.contributions(team, users.values().stream().map(m->m.getClassMember().getUser()).toList(), now)
                .forEach((id,at)->merge(latest,id,at,now));
        try {
            var additional=external.latest(team.getId(),team.getProjectId(),Set.copyOf(users.keySet()),now);
            if(additional!=null)additional.forEach((id,at)->{if(users.containsKey(id))merge(latest,id,at,now);});
        } catch(RuntimeException failure) {log.warn("External contributions unavailable for team {}; using recorded Board/Backlog activity",team.getId());}
        Map<Long,Instant> joins=new HashMap<>();
        store.joins(team.getId()).forEach(h->merge(joins,h.getMemberId(),h.getCreatedAt().atZone(settings.auditZone()).toInstant(),now));
        Map<Long,Instant> reminders=new HashMap<>();
        recipients.lastReminders(team.getId(),team.getTrainingClass().getTenantId(),Kind.INACTIVE)
                .forEach(row->reminders.put(row.getUserId(),row.getCreatedAt()));
        return users.entrySet().stream().map(entry->{
            var member=entry.getValue();var user=member.getClassMember().getUser();
            Instant joined=member.getCreatedAt()==null?null:member.getCreatedAt().atZone(settings.auditZone()).toInstant();
            Instant moved=joins.get(member.getClassMember().getId());
            if(moved!=null&&(joined==null||moved.isAfter(joined)))joined=moved;
            Instant last=latest.get(user.getId());
            if(last!=null&&(joined==null||last.isBefore(joined)))last=null;
            Instant baseline=last==null?joined:last;
            boolean inactive=joined!=null&&baseline!=null&&!baseline.isAfter(now.minus(settings.inactiveWindow()));
            Instant sent=reminders.get(user.getId()),next=sent==null?null:sent.plus(settings.cooldown());
            boolean cooling=next!=null&&now.isBefore(next);
            return new MemberRow(user.getId().toString(),access.describe(team),user.getUserCode(),user.getFullName(),
                    member.getRole(),joined,last,joined==null?"JOIN_DATE_UNKNOWN":inactive?"INACTIVE":last==null?"NEW_MEMBER":"ACTIVE",
                    inactive,sent,next,cooling,inactive&&!cooling);
        }).toList();
    }
    private void merge(Map<Long,Instant> values,Long id,Instant at,Instant now) {
        if(id!=null&&at!=null&&!at.isAfter(now))values.merge(id,at,(a,b)->a.isAfter(b)?a:b);
    }
}
