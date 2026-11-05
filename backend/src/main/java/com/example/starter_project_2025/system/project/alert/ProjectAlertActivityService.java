package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;

@Service @RequiredArgsConstructor
public class ProjectAlertActivityService {
    private final ProjectAlertReadStore store;
    private final ProjectAlertAccess access;
    private final ProjectAlertTaskStarts taskStarts;
    private final MemberReminderSettings settings;
    private final ProjectAlertRecipientRepository recipients;
    public List<MemberRow> members(ProjectTeam team,ProjectAlertReadStore.Scope scope,Instant now) {
        Map<Long,ProjectMember> users=new LinkedHashMap<>();
        scope.members().values().stream().filter(m->team.getId().equals(m.getTeam().getId()))
                .filter(m->m.getClassMember().getUser().getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                        &&Set.of("STUDENT","TRAINEE").contains(role.getName())))
                .forEach(m->users.put(m.getClassMember().getUser().getId(),m));
        if(users.isEmpty())return List.of();
        var work=taskStarts.load(team,scope,users.keySet(),now,settings.auditZone());
        Map<Long,Instant> latest=work.lastStarted();
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
            Instant pending=work.todoSince().get(user.getId());
            Instant baseline=pending;
            if(joined!=null&&(baseline==null||joined.isAfter(baseline)))baseline=joined;
            if(last!=null&&(baseline==null||last.isAfter(baseline)))baseline=last;
            boolean inactive=pending!=null&&joined!=null&&baseline!=null&&!baseline.isAfter(now.minus(settings.inactiveWindow()));
            Instant sent=reminders.get(user.getId()),next=sent==null?null:sent.plus(settings.cooldown());
            boolean cooling=next!=null&&now.isBefore(next);
            return new MemberRow(user.getId().toString(),access.describe(team),user.getUserCode(),user.getFullName(),
                    member.getRole(),joined,last,joined==null?"JOIN_DATE_UNKNOWN":inactive?"INACTIVE":pending==null?"NO_PENDING_TASKS":last==null?"NEW_ASSIGNMENT":"ACTIVE",
                    inactive,sent,next,cooling,inactive&&!cooling,null,pending);
        }).toList();
    }
    private void merge(Map<Long,Instant> values,Long id,Instant at,Instant now) {
        if(id!=null&&at!=null&&!at.isAfter(now))values.merge(id,at,(a,b)->a.isAfter(b)?a:b);
    }
}
