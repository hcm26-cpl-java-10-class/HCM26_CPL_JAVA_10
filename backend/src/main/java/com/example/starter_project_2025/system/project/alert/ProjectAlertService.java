package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.outbox.*;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import com.example.starter_project_2025.system.project.task.*;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import com.example.starter_project_2025.system.rbac.user.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.*;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.*;

@Service @RequiredArgsConstructor @Transactional(readOnly=true)
public class ProjectAlertService {
    private final ProjectAlertAccess access;
    private final ProjectAlertReadStore store;
    private final ProjectAlertActivityService activity;
    private final AlertMilestoneProgressSource progressSource;
    private final AlertMilestoneConfigRepository configs;
    private final ProjectTeamRepository teams;
    private final UserRepository users;
    private final ProjectAlertBatchRepository batches;
    private final ProjectAlertRecipientRepository recipients;
    private final ProjectAlertAuditRepository audits;
    private final OutboxEventRepository outbox;
    private final MemberReminderSettings reminderSettings;
    private final ObjectMapper json;
    private final Validator validator;
    private final EntityManager em;
    private final ProjectAlertArtifactReadStore artifacts;
    private final ProjectRepository projects;
    private final ProjectAlertMemberProgress memberProgress;
    private final ProjectAlertWorkResults workResults;
    @Autowired @Qualifier("memberReminderClock") private Clock clock;
    @Value("${app.project-alerts.time-zone:Asia/Ho_Chi_Minh}") private String timeZone;
    private ZoneId zone() {return ZoneId.of(timeZone);}

    public Options options() {
        User actor=access.actor();Map<String,Boolean> permissions=new LinkedHashMap<>();
        for(Kind kind:Kind.values()) {
            permissions.put(kind.name()+"_READ",access.has(actor,access.readPermission(kind)));
            permissions.put(kind.name()+"_SEND",access.has(actor,access.readPermission(kind))&&access.has(actor,access.sendPermission(kind)));
        }
        permissions.put("MILESTONE_CONFIGURE",canConfigure(actor));
        var allowed=access.allowed(actor);
        return new Options(allowed.stream().map(access::describe).toList(),permissions,timeZone,
                reminderSettings.inactiveWindow().toHours(),reminderSettings.cooldown().toSeconds(),access.classOptions(actor,allowed));
    }
    public Page<BacklogRow> backlog(Filter filter) {
        User actor=read(Kind.BACKLOG);Instant now=clock.instant();
        var scope=store.load(access.filter(actor,filter).stream().filter(access::monitoring).toList());
        var rows=scope.items().stream().filter(this::unfinished)
                .filter(item->inWindow(deadline(item),now,filter))
                .map(item->backlogRow(actor,scope,item,now))
                .sorted(Comparator.comparing(BacklogRow::deadline).thenComparing(BacklogRow::id)).toList();
        return page(rows,filter,now);
    }
    public Page<MilestoneRow> milestones(Filter filter) {
        User actor=read(Kind.MILESTONE);Instant now=clock.instant();
        var scope=store.load(access.filter(actor,filter).stream().filter(access::monitoring).toList());
        var milestones=store.milestones(scope.teams()).stream()
                .filter(m->Set.of("PLANNED","OPEN").contains(m.getStatus().name()))
                .filter(m->inWindow(m.getDeadline(),now,filter)).toList();
        var submissions=artifacts.summaries(milestones,now);
        var rows=milestones.stream().map(m->milestoneRow(actor,scope,m,now,submissions.getOrDefault(m.getId(),SubmissionSummary.none())))
                .sorted(Comparator.comparing(MilestoneRow::deadline).thenComparing(MilestoneRow::id)).toList();
        return page(rows,filter,now);
    }
    public Page<MemberRow> inactive(Filter filter,boolean inactiveOnly) {
        User actor=read(Kind.INACTIVE);Instant now=clock.instant();
        boolean canViewWork=canViewWorkResults(actor);
        var scope=store.load(access.filter(actor,filter).stream().filter(access::monitoring).toList());List<MemberRow> rows=new ArrayList<>();
        for(var team:scope.teams().values())for(var row:activity.members(team,scope,now)) {
            if(inactiveOnly&&!row.inactive())continue;
            rows.add(new MemberRow(row.id(),row.team(),row.userCode(),row.displayName(),row.projectRole(),row.joinedAt(),
                    row.lastContributionAt(),row.activityStatus(),row.inactive(),row.lastReminderAt(),row.nextReminderAt(),
                    row.coolingDown(),row.canSend()&&access.has(actor,access.sendPermission(Kind.INACTIVE)),
                    canViewWork?workResults.summarize(workResults.assigned(scope,team.getId(),Long.valueOf(row.id())),now,zone()):null));
        }
        rows.sort(Comparator.comparing(MemberRow::displayName,String.CASE_INSENSITIVE_ORDER).thenComparing(MemberRow::id));
        return page(rows,filter,now);
    }
    public MemberWorkDetail memberWork(Long teamId,Long userId) {
        User actor=read(Kind.INACTIVE);
        access.require(actor,"SPRINT_BACKLOG_READ");access.require(actor,"WORKSPACE_MEMBER_READ");
        var team=access.team(actor,teamId);var scope=store.load(List.of(team));Instant now=clock.instant();
        var member=scope.members().values().stream().filter(row->userId.equals(row.getClassMember().getUser().getId()))
                .filter(row->row.getClassMember().getUser().getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                        &&Set.of("STUDENT","TRAINEE").contains(role.getName())))
                .findFirst().orElseThrow(()->new ResourceNotFoundException("Current student member is unavailable in this team"));
        var assigned=workResults.assigned(scope,teamId,userId);
        return new MemberWorkDetail(userId,member.getClassMember().getUser().getFullName(),access.describe(team),
                workResults.summarize(assigned,now,zone()),assigned.stream().map(item->backlogRow(actor,scope,item,now))
                    .sorted(Comparator.comparing(BacklogRow::deadline,Comparator.nullsLast(Comparator.naturalOrder()))
                            .thenComparing(BacklogRow::id)).toList());
    }
    private boolean canViewWorkResults(User actor) {
        return access.has(actor,"SPRINT_BACKLOG_READ")&&access.has(actor,"WORKSPACE_MEMBER_READ");
    }
    public List<History> history(Long teamId,Kind kind) {
        User actor=read(kind);var team=access.team(actor,teamId);
        return batches.findTop100ByTeamIdAndTenantIdAndKindOrderByCreatedAtDesc(teamId,team.getTrainingClass().getTenantId(),kind).stream()
                .map(batch->new History(batch.getId(),batch.getKind(),batch.getWarningNote(),batch.getRecipientCount(),
                        status(batch.getId()),batch.getCreatedAt(),batch.getCorrelationId())).toList();
    }
    public LinkOptions links(Long teamId,UUID milestoneId) {
        User actor=read(Kind.MILESTONE);requireConfigure(actor);var team=access.team(actor,teamId);
        var milestone=milestone(team,actor,milestoneId,false);var scope=store.load(List.of(team));
        var selected=progressSource.backlogItemIds(milestoneId,teamId,team.getTrainingClass().getTenantId());
        Set<Long> visible=new HashSet<>();scope.items().forEach(item->visible.add(item.getId()));
        var selectedVisible=new HashSet<>(selected.orElse(Set.of()));selectedVisible.retainAll(visible);
        return new LinkOptions(selected.isPresent(),milestone.getVersion(),selectedVisible,
                scope.items().stream().map(item->backlogRow(actor,scope,item,clock.instant())).toList());
    }
    @Transactional
    public LinkOptions link(Long teamId,UUID milestoneId,Links request) {
        User actor=read(Kind.MILESTONE);requireConfigure(actor);access.team(actor,teamId);validate(request);
        teams.findForWorkspaceCreation(teamId).orElseThrow(()->new ResourceNotFoundException("Team is unavailable"));
        em.clear();actor=read(Kind.MILESTONE);requireConfigure(actor);var team=access.team(actor,teamId);
        lockProjectAndRequireMonitoring(team);
        var milestone=milestone(team,actor,milestoneId,true);
        if(milestone.getVersion()!=request.milestoneVersion())throw conflict("Milestone has changed. Reload its work items.");
        Set<Long> available=new HashSet<>();store.load(List.of(team)).items().forEach(item->available.add(item.getId()));
        if(!available.containsAll(request.backlogItemIds()))throw new TaskValidationException("backlogItemIds","Choose existing backlog items from this team");
        var config=configs.findById(milestoneId).orElseGet(ProjectAlertData.MilestoneConfig::new);
        config.setMilestoneId(milestoneId);config.setTeamId(teamId);config.setTenantId(team.getTrainingClass().getTenantId());
        config.setConfiguredBy(actor.getId());config.setConfiguredAt(clock.instant());
        config.setBacklogItemIds(new HashSet<>(request.backlogItemIds()));configs.saveAndFlush(config);
        return links(teamId,milestoneId);
    }
    @Transactional
    public Result send(UUID key,String correlation,Send request) {
        User actor=access.actor();validate(request);
        access.require(actor,access.readPermission(request.kind()));access.require(actor,access.sendPermission(request.kind()));
        access.team(actor,request.teamId());
        if(key==null)throw new TaskValidationException("idempotencyKey","Idempotency-Key is required");
        if(request.kind()!=Kind.MILESTONE&&(request.warningNote()==null||request.warningNote().isBlank()))
            throw new TaskValidationException("warningNote","Warning note is required");
        var context=TaskRequestContext.create(key,correlation);
        List<Selection> selected=request.selections().stream().map(s->new Selection(request.kind()==Kind.MILESTONE
                ?uuid(s.id()).toString():number(s.id()).toString(),s.version())).sorted(Comparator.comparing(Selection::id)).toList();
        if(selected.stream().map(Selection::id).distinct().count()!=selected.size())
            throw new TaskValidationException("selections","Select each item once");
        if(request.kind()==Kind.MILESTONE&&selected.size()!=1)
            throw new TaskValidationException("selections","Select one milestone per risk alert");
        teams.findForWorkspaceCreation(request.teamId()).orElseThrow(()->new ResourceNotFoundException("Team is unavailable"));
        String hash=fingerprint(new Send(request.teamId(),request.kind(),selected,request.warningNote()));
        var previous=batches.findByActorIdAndRequestId(actor.getId(),key);
        if(previous.isPresent()) {
            if(!hash.equals(previous.get().getRequestHash()))throw conflict("This Idempotency-Key was used with different data");
            return result(previous.get());
        }
        if(request.kind()==Kind.INACTIVE) {
            var scope=store.load(List.of(access.team(actor,request.teamId())));
            Set<Long> currentUsers=new HashSet<>();scope.members().values().forEach(m->currentUsers.add(m.getClassMember().getUser().getId()));
            var ids=selected.stream().map(s->number(s.id())).toList();
            if(!currentUsers.containsAll(ids))throw staleMember();
            if(users.lockForContribution(ids.stream().sorted().toList()).size()!=ids.size())throw staleMember();
        }
        em.clear();actor=read(request.kind());access.require(actor,access.sendPermission(request.kind()));
        ProjectTeam team=access.team(actor,request.teamId());Instant now=clock.instant();
        lockProjectAndRequireMonitoring(team);
        Set<Long> targets=new LinkedHashSet<>();List<Object> snapshots=new ArrayList<>();
        switch(request.kind()) {
            case BACKLOG -> {
                var ids=selected.stream().map(s->number(s.id())).toList();store.lockItems(ids).forEach(em::refresh);
                var scope=store.load(List.of(team));Map<Long,SprintBacklog> items=new HashMap<>();scope.items().forEach(item->items.put(item.getId(),item));
                for(var selection:selected) {
                    SprintBacklog item=items.get(number(selection.id()));
                    if(item==null||selection.version()==null||!selection.version().equals(item.getVersion())
                            ||!unfinished(item)||deadline(item)==null||!deadline(item).isBefore(now))
                        throw conflict("A selected backlog item changed, is no longer overdue, or left this team. Reload the list.");
                    var assignee=store.assignee(scope,item);
                    if(assignee==null)throw conflict("Every selected backlog item must have an active assignee in this team");
                    targets.add(assignee.getClassMember().getUser().getId());snapshots.add(backlogRow(actor,scope,item,now));
                }
            }
            case INACTIVE -> {
                var scope=store.load(List.of(team));Map<String,MemberRow> current=new HashMap<>();
                activity.members(team,scope,now).forEach(member->current.put(member.id(),member));
                List<CooldownMember> cooling=new ArrayList<>();
                for(var selection:selected) {
                    MemberRow row=current.get(selection.id());if(row==null||!row.inactive())throw staleMember();
                    if(row.coolingDown())cooling.add(new CooldownMember(number(row.id()),row.userCode(),row.displayName(),row.nextReminderAt()));
                    targets.add(number(row.id()));snapshots.add(row);
                }
                if(!cooling.isEmpty())throw new ProjectAlertCooldownException(cooling);
            }
            case MILESTONE -> {
                var selection=selected.getFirst();var milestone=milestone(team,actor,uuid(selection.id()),true);
                var configured=progressSource.backlogItemIds(milestone.getId(),team.getId(),team.getTrainingClass().getTenantId());
                if(configured.isPresent()&&!configured.get().isEmpty())store.lockItems(configured.get()).forEach(em::refresh);
                var scope=store.load(List.of(team));var row=milestoneRow(actor,scope,milestone,now);
                if(selection.version()==null||selection.version()!=milestone.getVersion()||!Set.of("AT_RISK","OVERDUE").contains(row.alertReason()))
                    throw conflict("This milestone changed, has received a valid submission, or no longer needs a deadline alert. Reload the list.");
                scope.members().values().stream().map(m->m.getClassMember().getUser())
                        .filter(user->user.getRoles().stream().anyMatch(role->Boolean.TRUE.equals(role.getIsActive())
                                &&Set.of("STUDENT","TRAINEE").contains(role.getName()))).forEach(user->targets.add(user.getId()));
                if(targets.isEmpty())throw conflict("This team has no active student recipients");
                snapshots.add(row);
                if(row.progress().atRisk())milestone.markAtRisk(UUID.nameUUIDFromBytes(("user:"+actor.getId()).getBytes(StandardCharsets.UTF_8)),now);
            }
        }
        String note=request.warningNote()==null?"":request.warningNote();
        if(request.kind()==Kind.MILESTONE&&note.isBlank())note="Milestone "+((MilestoneRow)snapshots.getFirst()).title()
                +("OVERDUE".equals(((MilestoneRow)snapshots.getFirst()).alertReason())?" is overdue and has no valid submission. Please review your progress."
                :" is at risk of missing the deadline. Please review your progress.");
        var batch=new ProjectAlertData.Batch();batch.setId(UUID.randomUUID());batch.setTeamId(team.getId());batch.setProjectId(team.getProjectId());
        batch.setTenantId(team.getTrainingClass().getTenantId());batch.setActorId(actor.getId());batch.setRequestId(key);batch.setKind(request.kind());
        batch.setRequestHash(hash);batch.setWarningNote(note);batch.setRecipientCount(targets.size());batch.setCreatedAt(now);
        batch.setCorrelationId(context.correlationId());batches.saveAndFlush(batch);
        for(Long id:targets) {var recipient=new ProjectAlertData.Recipient();recipient.setId(UUID.randomUUID());recipient.setBatch(batch);recipient.setUserId(id);recipients.save(recipient);}
        String eventType=switch(request.kind()) {case BACKLOG->"BACKLOG_OVERDUE_ALERT_BATCH_SENT";
            case MILESTONE->"OVERDUE".equals(((MilestoneRow)snapshots.getFirst()).alertReason())?"MILESTONE_OVERDUE_ALERT_SENT":"MILESTONE_AT_RISK_ALERT_SENT";
            case INACTIVE->"INACTIVE_MEMBER_ALERT_BATCH_SENT";};
        Map<String,Object> event=new LinkedHashMap<>();event.put("schema_version",2);event.put("event_id",batch.getId());event.put("event_type",eventType);
        event.put("tenant_id",team.getTrainingClass().getTenantId());event.put("team_id",team.getId());event.put("class_id",team.getTrainingClass().getId());
        event.put("project_id",team.getProjectId());event.put("actor_id",actor.getId());event.put("warning_note",note);
        event.put("recipient_user_ids",targets);event.put("items",snapshots);event.put("channels",List.of("IN_APP","EMAIL"));
        event.put("occurred_at",now);event.put("correlation_id",context.correlationId());
        outbox.saveAndFlush(OutboxEvent.projectAlertBatch(batch.getId(),eventType,encode(event),now));
        var audit=new ProjectAlertData.Audit();audit.setId(UUID.randomUUID());audit.setBatchId(batch.getId());audit.setTeamId(team.getId());
        audit.setActorId(actor.getId());audit.setAction(eventType);audit.setOccurredAt(now);audit.setCorrelationId(context.correlationId());
        audit.setBeforeState(encode(snapshots));audit.setAfterState(encode(Map.of("event_id",batch.getId(),"status","PENDING","recipient_user_ids",targets)));
        audits.saveAndFlush(audit);return result(batch);
    }
    private User read(Kind kind) {User actor=access.actor();access.require(actor,access.readPermission(kind));return actor;}
    private boolean canConfigure(User user) {return access.has(user,"MILESTONE_WRITE")&&access.has(user,"SPRINT_BACKLOG_READ");}
    private void requireConfigure(User user) {access.require(user,"MILESTONE_WRITE");access.require(user,"SPRINT_BACKLOG_READ");}
    private Milestone milestone(ProjectTeam team,User actor,UUID id,boolean lock) {
        var query=em.createQuery("select m from Milestone m where m.id=:id and m.teamId=:team and m.tenantId=:tenant and m.active=true",Milestone.class)
                .setParameter("id",id).setParameter("team",team.getId()).setParameter("tenant",team.getTrainingClass().getTenantId());
        if(lock)query.setLockMode(LockModeType.PESSIMISTIC_WRITE);
        var row=query.getResultStream().findFirst().orElseThrow(()->new ResourceNotFoundException("Milestone does not exist or has been changed"));
        if(lock)em.refresh(row);
        if(row.getProjectId()!=null&&!Objects.equals(row.getProjectId(),team.getProjectId()))
            throw new ResourceNotFoundException("Milestone does not exist or has been changed");
        return row;
    }
    private BacklogRow backlogRow(User actor,ProjectAlertReadStore.Scope scope,SprintBacklog item,Instant now) {
        var assignee=store.assignee(scope,item);Instant due=deadline(item);
        return new BacklogRow(item.getId().toString(),access.describe(store.owner(scope,item)),item.getTitle(),
                item.getWorkType().name(),item.getStatus().name(),due,deadlineStatus(due,now),item.getVersion(),
                assignee==null?null:assignee.getClassMember().getUser().getId(),assignee==null?null:assignee.getClassMember().getUser().getFullName(),
                access.monitoring(store.owner(scope,item))&&access.has(actor,access.sendPermission(Kind.BACKLOG))
                        &&assignee!=null&&unfinished(item)&&due!=null&&due.isBefore(now));
    }
    private MilestoneRow milestoneRow(User actor,ProjectAlertReadStore.Scope scope,Milestone milestone,Instant now) {
        return milestoneRow(actor,scope,milestone,now,artifacts.summaries(List.of(milestone),now)
                .getOrDefault(milestone.getId(),SubmissionSummary.none()));
    }
    private MilestoneRow milestoneRow(User actor,ProjectAlertReadStore.Scope scope,Milestone milestone,Instant now,SubmissionSummary submission) {
        var linked=progressSource.backlogItemIds(milestone.getId(),milestone.getTeamId(),milestone.getTenantId());
        var items=linked.isEmpty()?List.<SprintBacklog>of():scope.items().stream()
                .filter(item->milestone.getTeamId().equals(store.owner(scope,item).getId())&&linked.get().contains(item.getId())).toList();
        long done=items.stream().filter(item->item.getStatus()==SprintBacklogStatus.DONE).count(),total=items.size();
        BigDecimal percentage=linked.isEmpty()?null:total==0?BigDecimal.ZERO:BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total),2,RoundingMode.HALF_UP);
        boolean below=total==0||BigDecimal.valueOf(done).multiply(BigDecimal.valueOf(100)).compareTo(BigDecimal.valueOf(total).multiply(BigDecimal.valueOf(80)))<0;
        boolean received="SUBMITTED".equals(submission.status());
        boolean atRisk=!received&&linked.isPresent()&&milestone.getStatus()==MilestoneStatus.OPEN&&milestone.getDeadline().isAfter(now)
                &&milestone.getDeadline().isBefore(now.plus(Duration.ofHours(48)))&&below;
        boolean overdue=!received&&Set.of(MilestoneStatus.PLANNED,MilestoneStatus.OPEN).contains(milestone.getStatus())&&milestone.getDeadline().isBefore(now);
        String reason=received?"AWAITING_REVIEW":overdue?"OVERDUE":atRisk?"AT_RISK":"NONE";
        boolean canViewMembers=access.has(actor,"WORKSPACE_MEMBER_READ");
        var breakdown=canViewMembers&&linked.isPresent()?memberProgress.calculate(milestone.getTeamId(),scope,items):null;
        return new MilestoneRow(milestone.getId().toString(),access.describe(scope.teams().get(milestone.getTeamId())),milestone.getTitle(),
                milestone.getStatus().name(),milestone.getDeadline(),deadlineStatus(milestone.getDeadline(),now),milestone.getVersion(),milestone.isAtRisk(),
                new Progress(linked.isPresent(),done,total,percentage,"BACKLOG_ITEMS",atRisk),
                (atRisk||overdue)&&access.monitoring(scope.teams().get(milestone.getTeamId()))&&access.has(actor,access.sendPermission(Kind.MILESTONE)),
                canConfigure(actor)&&access.monitoring(scope.teams().get(milestone.getTeamId())),milestone.isMandatory(),submission,reason,
                canViewMembers,breakdown==null?null:breakdown.members(),breakdown==null?null:breakdown.workWithoutCurrentStudent());
    }
    private void lockProjectAndRequireMonitoring(ProjectTeam team) {
        if (team.getProjectId()!=null) {
            var project=projects.findForWorkspaceCreation(team.getProjectId()).orElseThrow(()->conflict("Project is no longer available"));
            em.refresh(project);
        }
        access.requireMonitoring(team);
    }
    private boolean unfinished(SprintBacklog item) {return item.getStatus()==SprintBacklogStatus.TODO||item.getStatus()==SprintBacklogStatus.IN_PROGRESS;}
    private Instant deadline(SprintBacklog item) {return item.getEndDate()==null?null:item.getEndDate().atZone(zone()).toInstant();}
    private String deadlineStatus(Instant due,Instant now) {return due==null?"NO_DEADLINE":due.isBefore(now)?"OVERDUE":"UPCOMING";}
    private boolean inWindow(Instant due,Instant now,Filter filter) {
        if(due==null||due.isAfter(now.plus(Duration.ofHours(filter.windowHours()))))return false;
        return "ALL".equals(filter.deadlineStatus())||filter.deadlineStatus().equals(deadlineStatus(due,now));
    }
    private <T> Page<T> page(List<T> rows,Filter filter,Instant now) {
        return new Page<>(rows.stream().skip((long)filter.page()*filter.size()).limit(filter.size()).toList(),rows.size(),filter.page(),filter.size(),now,timeZone);
    }
    private void validate(Object request) {
        if(request==null)throw new TaskValidationException("request","Request is required");
        Map<String,List<String>> errors=new LinkedHashMap<>();validator.validate(request).forEach(error->
                errors.computeIfAbsent(error.getPropertyPath().toString(),ignored->new ArrayList<>()).add(error.getMessage()));
        if(!errors.isEmpty())throw new TaskValidationException(errors);
    }
    private Long number(String value) {try {Long id=Long.valueOf(value);if(id<=0)throw new NumberFormatException();return id;}
        catch(NumberFormatException invalid){throw new TaskValidationException("selections","Choose a valid item ID");}}
    private UUID uuid(String value) {try{return UUID.fromString(value);}catch(IllegalArgumentException invalid){throw new TaskValidationException("selections","Choose a valid milestone ID");}}
    private TaskConflictException conflict(String message) {return new TaskConflictException(message);}
    private TaskConflictException staleMember() {return conflict("A selected member contributed recently or left the team. Reload the member list.");}
    private String status(UUID id) {return outbox.findById(id).orElseThrow().getStatus().name();}
    private Result result(ProjectAlertData.Batch batch) {return new Result(batch.getId(),batch.getId(),status(batch.getId()),batch.getRecipientCount(),batch.getCreatedAt(),batch.getCorrelationId());}
    private String encode(Object value) {try{return json.writeValueAsString(value);}catch(com.fasterxml.jackson.core.JsonProcessingException failure){throw new IllegalStateException("Unable to serialize alert",failure);}}
    private String fingerprint(Send request) {try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(encode(request).getBytes(StandardCharsets.UTF_8)));}
        catch(java.security.NoSuchAlgorithmException failure){throw new IllegalStateException(failure);}}
}
