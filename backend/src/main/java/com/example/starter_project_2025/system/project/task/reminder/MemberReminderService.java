package com.example.starter_project_2025.system.project.task.reminder;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditRepository;
import com.example.starter_project_2025.system.project.task.alert.*;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
import com.example.starter_project_2025.system.rbac.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.validation.Validator;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.task.reminder.MemberReminderDtos.*;
import static com.example.starter_project_2025.system.project.task.reminder.MemberReminderData.*;

@Slf4j @Service @Transactional(readOnly=true)
public class MemberReminderService {
    public static final String EVENT_TYPE="INACTIVE_MEMBER_ALERT_BATCH_SENT";
    private static final Set<String> CONTRIBUTIONS=Set.of("CREATE","UPDATE","STATUS_CHANGED","ARTIFACT_SUBMITTED","ARTIFACT_UPDATED","CODE_COMMITTED");
    private final TaskAlertAccess access;
    private final TaskAlertProjectLinkRepository projectLinks;
    private final UserRepository users;
    private final TaskAuditRepository taskAudit;
    private final MemberContributionPort contributions;
    private final MemberReminderSettings settings;
    private final MemberReminderBatchRepository batches;
    private final MemberReminderItemRepository items;
    private final MemberReminderAuditRepository audit;
    private final OutboxEventRepository outbox;
    private final Validator validator;
    private final ObjectMapper json;
    private final EntityManager em;
    private final Clock clock;
    public MemberReminderService(TaskAlertAccess access,TaskAlertProjectLinkRepository projectLinks,UserRepository users,
            TaskAuditRepository taskAudit,MemberContributionPort contributions,MemberReminderSettings settings,
            MemberReminderBatchRepository batches,MemberReminderItemRepository items,MemberReminderAuditRepository audit,
            OutboxEventRepository outbox,Validator validator,ObjectMapper json,EntityManager em,@Qualifier("memberReminderClock") Clock clock){
        this.access=access;this.projectLinks=projectLinks;this.users=users;this.taskAudit=taskAudit;this.contributions=contributions;
        this.settings=settings;this.batches=batches;this.items=items;this.audit=audit;this.outbox=outbox;this.validator=validator;
        this.json=json;this.em=em;this.clock=clock;
    }
    public Page list(UUID projectId,boolean inactiveOnly){
        User actor=access.actor("INACTIVE_MEMBER_READ");access.project(actor,projectId,true);
        var rows=members(projectId,actor,clock.instant());
        return new Page(projectId,access.directory().project(projectId).getName(),settings.inactiveWindow().toHours(),
                settings.cooldown().toSeconds(),access.permitted(actor,"INACTIVE_MEMBER_SEND"),
                rows.stream().filter(row->!inactiveOnly||row.inactive()).toList());
    }
    private List<Member> members(UUID projectId,User actor,Instant now){
        var roster=access.directory().studentRoster(projectId,actor.getId(),settings.auditZone());
        if(roster.isEmpty())return List.of();
        Set<Long> ids=new HashSet<>();roster.forEach(row->ids.add(row.userId()));
        Map<Long,Instant> latest=new HashMap<>();
        taskAudit.latestContributions(projectId,ids,CONTRIBUTIONS,LocalDateTime.ofInstant(now,settings.auditZone()))
                .forEach(row->latest.put(row.getActorId(),row.getOccurredAt().atZone(settings.auditZone()).toInstant()));
        try{
            var external=contributions.latest(projectId,Set.copyOf(ids),now);
            if(external!=null)external.forEach((id,at)->{if(ids.contains(id)&&at!=null&&!at.isAfter(now))
                latest.merge(id,at,(a,b)->a.isAfter(b)?a:b);});
        }catch(RuntimeException exception){log.warn("External contributions unavailable; using Task Audit fallback");}
        Map<Long,Instant> lastSent=new HashMap<>();
        items.lastReminders(projectId,actor.getTenant().getId()).forEach(row->lastSent.put(row.getUserId(),row.getCreatedAt()));
        return roster.stream().map(row->{
            Instant joined=row.joinedAt(),last=latest.get(row.userId());
            if(last!=null&&(joined==null||last.isBefore(joined)))last=null;
            Instant baseline=last!=null?last:joined;
            boolean inactive=joined!=null&&baseline!=null&&!baseline.isAfter(now.minus(settings.inactiveWindow()));
            String status=joined==null?"JOIN_DATE_UNKNOWN":inactive?"INACTIVE":last==null?"NEW_MEMBER":"ACTIVE";
            Instant sent=lastSent.get(row.userId()),next=sent==null?null:sent.plus(settings.cooldown());
            return new Member(row.userId(),row.userCode(),row.displayName(),joined,last,status,inactive,sent,next,next!=null&&now.isBefore(next));
        }).toList();
    }
    @Transactional
    public Result send(UUID projectId,UUID key,String correlation,Send request){
        User actor=access.actor("INACTIVE_MEMBER_SEND");access.project(actor,projectId,true);
        var context=TaskRequestContext.create(key,correlation);
        if(key==null)throw new TaskValidationException("idempotencyKey","Idempotency-Key is required");
        if(request==null)throw new TaskValidationException("request","Request is required");
        Map<String,List<String>> errors=new LinkedHashMap<>();
        validator.validate(request).forEach(error->errors.computeIfAbsent(error.getPropertyPath().toString().startsWith("recipientUserIds")
                ?"recipientUserIds":error.getPropertyPath().toString(),ignored->new ArrayList<>()).add(error.getMessage()));
        if(!errors.isEmpty())throw new TaskValidationException(errors);
        var ids=request.recipientUserIds().stream().sorted().toList();
        if(new HashSet<>(ids).size()!=ids.size())throw new TaskValidationException("recipientUserIds","Select each member once");
        projectLinks.lock(projectId).orElseThrow(()->new org.springframework.security.access.AccessDeniedException("Project is unavailable"));
        String hash=fingerprint(projectId,new Send(ids,request.warningNote()));
        var old=batches.findByActorIdAndRequestId(actor.getId(),key);
        if(old.isPresent()){
            if(!hash.equals(old.get().getRequestHash()))throw new TaskConflictException("This Idempotency-Key was used for a different reminder");
            return result(old.get());
        }
        // Shared by TaskAuditService and TeamMembershipService. No task row is locked here,
        // avoiding a task/user lock cycle while serializing contribution and roster commits.
        Set<Long> visibleIds=new HashSet<>();
        access.directory().studentRoster(projectId,actor.getId(),settings.auditZone()).forEach(row->visibleIds.add(row.userId()));
        if(!visibleIds.containsAll(ids))throw stale();
        if(users.lockForContribution(ids).size()!=ids.size())throw stale();
        em.clear();
        actor=access.actor("INACTIVE_MEMBER_SEND");access.project(actor,projectId,true);
        Instant now=clock.instant();
        Map<Long,Member> current=new HashMap<>();members(projectId,actor,now).forEach(row->current.put(row.userId(),row));
        List<Member> selected=new ArrayList<>();
        for(Long id:ids){Member member=current.get(id);if(member==null||!member.inactive())throw stale();selected.add(member);}
        var cooldown=selected.stream().filter(Member::coolingDown)
                .map(row->new CooldownMember(row.userId(),row.userCode(),row.displayName(),row.nextReminderAt())).toList();
        if(!cooldown.isEmpty())throw new MemberReminderCooldownException(cooldown);
        Batch batch=new Batch();batch.setId(UUID.randomUUID());batch.setProjectId(projectId);batch.setTenantId(actor.getTenant().getId());
        batch.setActorId(actor.getId());batch.setRequestId(key);batch.setRequestHash(hash);batch.setWarningNote(request.warningNote());
        batch.setRecipientCount(ids.size());batch.setCreatedAt(now);batch.setCorrelationId(context.correlationId());batches.saveAndFlush(batch);
        for(Long id:ids){Item item=new Item();item.setId(UUID.randomUUID());item.setBatch(batch);item.setRecipientUserId(id);items.save(item);}
        Event event=new Event(batch.getId(),EVENT_TYPE,projectId,batch.getTenantId(),actor.getId(),request.warningNote(),
                ids,List.of("IN_APP","EMAIL"),now,context.correlationId());
        outbox.saveAndFlush(OutboxEvent.inactiveMemberAlertBatch(batch.getId(),projectId,encode(event),now));
        Audit entry=new Audit();entry.setId(UUID.randomUUID());entry.setBatchId(batch.getId());entry.setProjectId(projectId);
        entry.setAction(EVENT_TYPE);
        entry.setActorId(actor.getId());entry.setOccurredAt(now);entry.setCorrelationId(context.correlationId());
        entry.setBeforeState(encode(selected));entry.setAfterState(encode(Map.of("recipient_user_ids",ids,"status","PENDING","event_id",batch.getId())));
        audit.saveAndFlush(entry);
        return result(batch);
    }
    public List<History> history(UUID projectId,Long userId){
        User actor=access.actor("INACTIVE_MEMBER_READ");access.project(actor,projectId,true);
        boolean current=access.directory().studentRoster(projectId,actor.getId(),settings.auditZone()).stream().anyMatch(row->row.userId().equals(userId));
        if(!current)throw new ResourceNotFoundException("Member is unavailable in this team");
        return items.history(projectId,actor.getTenant().getId(),userId).stream().map(item->{
            var batch=item.getBatch();return new History(batch.getId(),batch.getActorId(),batch.getWarningNote(),status(batch),batch.getCreatedAt(),batch.getCorrelationId());
        }).toList();
    }
    private TaskConflictException stale(){return new TaskConflictException("One or more selected members contributed recently or left the team. Reload the member list.");}
    private String status(Batch batch){return outbox.findById(batch.getId()).orElseThrow().getStatus().name();}
    private Result result(Batch batch){return new Result(batch.getId(),batch.getId(),batch.getProjectId(),batch.getRecipientCount(),status(batch),batch.getCreatedAt(),batch.getCorrelationId());}
    private String fingerprint(UUID projectId,Send request){
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(encode(List.of(projectId,request)).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException exception){throw new IllegalStateException(exception);}
    }
    private String encode(Object value){
        try{return json.writeValueAsString(value);}
        catch(com.fasterxml.jackson.core.JsonProcessingException exception){throw new IllegalStateException("Unable to serialize member reminder",exception);}
    }
}
