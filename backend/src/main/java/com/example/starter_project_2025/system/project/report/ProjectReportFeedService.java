package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.activity.ProjectActivityLog;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

/** Read-only feed over authorized matching Projects, before Master pagination. */
@Service
@RequiredArgsConstructor
public class ProjectReportFeedService {
    private final EntityManager em;
    private final ObjectMapper json;
    private final MemberReminderSettings time;
    private final ProjectReportSettings settings;

    public ActivityPage page(ProjectReportService.Snapshot snapshot, int offset, int limit, Instant before) {
        if (offset < 0 || limit < 1 || limit > 50 || before != null && before.isAfter(snapshot.asOf()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Điều kiện tải hoạt động không hợp lệ");
        Instant asOf = before == null ? snapshot.asOf() : before;
        var all = all(snapshot, asOf);
        int from = Math.min(offset, all.size()), end = (int) Math.min((long) from + limit, all.size());
        return new ActivityPage(all.subList(from, end), from, limit, end < all.size(), asOf);
    }

    public List<ActivityRow> all(ProjectReportService.Snapshot snapshot, Instant asOf) {
        return all(snapshot, asOf, null, null);
    }

    public ActivityHistory history(ProjectReportService.Snapshot snapshot, int page, int size,
                                   LocalDate from, LocalDate to, Instant before) {
        if (page < 0 || size < 1 || size > 50 || before != null && before.isAfter(snapshot.asOf()))
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Điều kiện tải lịch sử không hợp lệ");
        Instant asOf = before == null ? snapshot.asOf() : before;
        LocalDate last = to == null ? asOf.atZone(settings.zone()).toLocalDate() : to;
        LocalDate first = from == null ? last.minusDays(6) : from;
        if (first.isAfter(last) || first.getYear() < 1 || last.getYear() > 9999)
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc");
        Instant start = first.atStartOfDay(settings.zone()).toInstant();
        Instant end = last.plusDays(1).atStartOfDay(settings.zone()).toInstant();
        var events = all(snapshot, asOf, start, end);
        int begin = (int) Math.min((long) page * size, events.size());
        int finish = Math.min(begin + size, events.size());
        return new ActivityHistory(events.subList(begin, finish), page, size, events.size(), asOf, first, last);
    }

    private <T> jakarta.persistence.TypedQuery<T> activityQuery(String jpql, Class<T> type, String field,
                                                               Instant from, Instant until, boolean localTime) {
        if (from != null) jpql += " and " + field + ">=:activityStart";
        if (until != null) jpql += " and " + field + "<:activityEnd";
        var query = em.createQuery(jpql, type);
        if (from != null) query.setParameter("activityStart", localTime ? LocalDateTime.ofInstant(from, time.auditZone()) : from);
        if (until != null) query.setParameter("activityEnd", localTime ? LocalDateTime.ofInstant(until, time.auditZone()) : until);
        return query;
    }

    private List<ActivityRow> all(ProjectReportService.Snapshot snapshot, Instant asOf, Instant from, Instant until) {
        Map<Long,SubProject> rows = snapshot.matching().stream().collect(Collectors.toMap(SubProject::id, row -> row));
        if (rows.isEmpty()) return List.of();
        Long tenant = snapshot.actor().tenantId();
        LocalDateTime localEnd = LocalDateTime.ofInstant(asOf, time.auditZone());
        Map<Long,String> actors = new HashMap<>();
        Map<UUID,String> uuids = new HashMap<>();
        for (Object[] actor : em.createQuery("select u.id,u.email,u.firstName,u.lastName from User u where u.tenantId=:tenant", Object[].class)
                .setParameter("tenant", tenant).getResultList()) {
            String name = (Objects.toString(actor[2], "") + " " + Objects.toString(actor[3], "")).trim();
            actors.put((Long) actor[0], name.isBlank() ? "Người dùng" : name);
            if (actor[1] != null) uuids.put(UUID.nameUUIDFromBytes(actor[1].toString().getBytes(StandardCharsets.UTF_8)), actors.get(actor[0]));
        }
        Map<String,ActivityRow> events = new LinkedHashMap<>();
        for (var event : activityQuery("select a from ProjectActivityLog a where a.projectId in :projects and a.occurredAt<=:end", ProjectActivityLog.class,
                "a.occurredAt", from, until, true)
                .setParameter("projects", rows.keySet()).setParameter("end", localEnd).getResultList()) {
            var row = rows.get(event.getProjectId());
            String subject = event.getEntityType() + (event.getEntityId() == null ? "" : " #" + event.getEntityId());
            String href = workspace(row);
            if ("TASK".equals(event.getEntityType()) && event.getEntityId() != null) {
                var task = em.find(com.example.starter_project_2025.system.project.sprint.Task.class, event.getEntityId());
                if (task != null) {
                    if (!Objects.equals(task.getProjectId(), row.id()) || task.getTeamId() != null && !Objects.equals(task.getTeamId(), row.teamId())) continue;
                    subject = task.getTitle();
                    if (href == null && task.getSprintId() != null) href = "/project-board?projectId=" + row.id() + "&sprintId=" + task.getSprintId();
                }
            }
            add(events, "board:" + event.getId(), row, instant(event.getOccurredAt()),
                    actors.getOrDefault(event.getActorId(), Objects.toString(event.getActorDisplayName(), "Người dùng")),
                    event.getEntityType(), Objects.toString(event.getEntityId(), ""), subject, event.getActionType(),
                    state(event.getBeforeState()), state(event.getAfterState()), href, event.getCorrelationId());
        }
        Map<Long,SprintBacklog> items = new HashMap<>();
        rows.keySet().forEach(id -> snapshot.source().backlogs().getOrDefault(id, List.of()).forEach(item -> items.put(item.getId(), item)));
        if (!items.isEmpty()) {
            for (var event : activityQuery("select a from BacklogItemAuditLog a where a.sprintBacklogId in :items and a.createdAt<=:end", SprintBacklogAuditLog.class,
                    "a.createdAt", from, until, true)
                    .setParameter("items", items.keySet()).setParameter("end", localEnd).getResultList()) {
                var item = items.get(event.getSprintBacklogId());
                var row = rows.get(ProjectReportQueryRepository.projectId(item));
                add(events, "backlog:" + event.getId(), row, instant(event.getCreatedAt()), actors.getOrDefault(event.getActorId(), "Người dùng"),
                        "BACKLOG", item.getId().toString(), item.getTitle(), "BACKLOG_" + event.getAction(),
                        state(event.getBeforeState()), state(event.getAfterState()), workspace(row), event.getCorrelationId());
            }
            for (Object[] event : activityQuery("select a,t,p.projectId from TaskAuditLog a,ProjectTask t,TaskAlertProjectLink p "
                            + "where a.taskId=t.id and a.projectId=t.projectId and t.projectId=p.id and p.tenantId=:tenant "
                            + "and p.projectId in :projects and t.backlogItem.id in :items and a.occurredAt<=:end", Object[].class,
                    "a.occurredAt", from, until, true)
                    .setParameter("tenant", tenant).setParameter("projects", rows.keySet()).setParameter("items", items.keySet())
                    .setParameter("end", localEnd).getResultList()) {
                var audit = (com.example.starter_project_2025.system.project.task.audit.TaskAuditLog) event[0];
                var task = (com.example.starter_project_2025.system.project.task.Task) event[1];
                var parent = items.get(task.getBacklogItem().getId());
                if (!Objects.equals(ProjectReportQueryRepository.projectId(parent), event[2])) continue;
                var row = rows.get((Long) event[2]);
                add(events, "subtask:" + audit.getId(), row, instant(audit.getOccurredAt()), actors.getOrDefault(audit.getActorId(), "Người dùng"),
                        "SUBTASK", task.getId().toString(), task.getTitle(), "TASK_" + audit.getAction(), state(audit.getBeforeState()),
                        state(audit.getAfterState()), "/tasks/" + task.getId() + "/detail", audit.getCorrelationId());
            }
        }
        Map<UUID,Milestone> milestones = new HashMap<>();
        rows.keySet().forEach(id -> snapshot.source().milestones().getOrDefault(id, List.of()).forEach(stage -> milestones.put(stage.getId(), stage)));
        if (!milestones.isEmpty()) {
            Set<UUID> submittedArtifacts = new HashSet<>();
            Set<String> reviewMirrors = new HashSet<>();
            for (Object[] event : activityQuery("select a,s,v from SubmissionAuditLog a,MilestoneSubmission s,SubmissionVersion v "
                            + "where a.submissionId=s.id and a.submissionVersionId=v.id and v.submission.id=s.id "
                            + "and s.tenantId=:tenant and s.milestone.id in :milestones and a.occurredAt<=:end", Object[].class,
                    "a.occurredAt", from, until, false)
                    .setParameter("tenant", tenant).setParameter("milestones", milestones.keySet()).setParameter("end", asOf).getResultList()) {
                var audit = (SubmissionAuditLog) event[0];
                var submission = (MilestoneSubmission) event[1];
                var version = (SubmissionVersion) event[2];
                var stage = milestones.get(submission.getMilestone().getId());
                if (!Objects.equals(stage.getTeamId(), submission.getTeamId())
                        || submission.getProjectId() != null && !Objects.equals(stage.getProjectId(), submission.getProjectId())) continue;
                var row = rows.get(stage.getProjectId());
                String actor = uuids.getOrDefault(audit.getActorId(), audit.getActorId().equals(submission.getStudentId())
                        ? submission.getStudentName() : audit.getActorId().equals(submission.getAssignedReviewerId()) ? submission.getAssignedReviewerName() : "Người dùng");
                String action = audit.getAction();
                String after = decision(action);
                add(events, "submission:" + audit.getId(), row, audit.getOccurredAt(), actor, "SUBMISSION", submission.getId().toString(),
                        stage.getTitle() + " · v" + version.getVersionNumber(), action, null, after,
                        "/milestone-submissions/" + submission.getId() + "/review", audit.getIdempotencyKey());
                if ("SUBMISSION_SUBMITTED".equals(action) && version.getArtifactSubmissionId() != null) submittedArtifacts.add(version.getArtifactSubmissionId());
                if (after != null) reviewMirrors.add(stage.getId() + ":" + after + ":" + audit.getActorId() + ":" + audit.getOccurredAt());
            }
            // Legacy submissions also carry real submit timestamps; ignore copies already represented by the version audit.
            for (var artifact : activityQuery("select a from MilestoneArtifactSubmission a where a.tenantId=:tenant "
                            + "and a.milestoneId in :milestones and a.submittedAt<=:end", MilestoneArtifactSubmission.class,
                    "a.submittedAt", from, until, false)
                    .setParameter("tenant", tenant).setParameter("milestones", milestones.keySet()).setParameter("end", asOf).getResultList()) {
                var stage = milestones.get(artifact.getMilestoneId());
                if (submittedArtifacts.contains(artifact.getId()) || !Objects.equals(stage.getTeamId(), artifact.getTeamId())
                        || artifact.getProjectId() != null && !Objects.equals(stage.getProjectId(), artifact.getProjectId())) continue;
                var row = rows.get(stage.getProjectId());
                add(events, "artifact:" + artifact.getId(), row, artifact.getSubmittedAt(), uuids.getOrDefault(artifact.getSubmitterId(), "Người dùng"),
                        "SUBMISSION", artifact.getId().toString(), stage.getTitle() + " · v" + artifact.getVersion(), "SUBMISSION_SUBMITTED", null,
                        "SUBMITTED", milestoneLink(row, stage.getId()), null);
            }
            for (var audit : activityQuery("select a from MilestoneAuditLog a where a.tenantId=:tenant and a.projectId in :projects "
                            + "and a.milestoneId in :milestones and a.createdAt<=:end", MilestoneAuditLog.class,
                    "a.createdAt", from, until, false)
                    .setParameter("tenant", tenant).setParameter("projects", rows.keySet()).setParameter("milestones", milestones.keySet())
                    .setParameter("end", asOf).getResultList()) {
                var stage = milestones.get(audit.getMilestoneId());
                if (!Objects.equals(stage.getProjectId(), audit.getProjectId()) || audit.getAction().startsWith("ARTIFACT_")) continue;
                String after = decision(audit.getAction());
                if (reviewMirrors.contains(stage.getId() + ":" + after + ":" + audit.getActorId() + ":" + audit.getCreatedAt())) continue;
                var row = rows.get(stage.getProjectId());
                add(events, "milestone:" + audit.getId(), row, audit.getCreatedAt(), uuids.getOrDefault(audit.getActorId(), "Hệ thống"),
                        "MILESTONE", stage.getId().toString(), stage.getTitle(), audit.getAction(), null, after,
                        milestoneLink(row, stage.getId()), audit.getCorrelationId());
            }
        }
        return events.values().stream().filter(event -> event.occurredAt() != null && !event.occurredAt().isAfter(asOf)
                        && (from == null || !event.occurredAt().isBefore(from)) && (until == null || event.occurredAt().isBefore(until)))
                .sorted(Comparator.comparing(ActivityRow::occurredAt).reversed().thenComparing(ActivityRow::id)).toList();
    }

    private void add(Map<String,ActivityRow> events, String id, SubProject row, Instant at, String actor, String type,
                     String entity, String subject, String action, String before, String after, String href, String correlation) {
        if (row == null || at == null) return;
        String key = row.id() + ":" + type + ":" + entity + ":" + action + ":"
                + (correlation == null || correlation.isBlank() ? id : correlation);
        var event = new ActivityRow(id, at, row.id(), row.code(), row.name(), row.masterName(), row.teamId(), row.teamName(),
                actor, type, entity, subject, action, before, after, href);
        events.merge(key, event, (previous, next) -> previous.id().compareTo(next.id()) <= 0 ? previous : next);
    }
    private Instant instant(LocalDateTime value) { return value == null ? null : value.atZone(time.auditZone()).toInstant(); }
    private String state(String value) {
        if (value == null) return null;
        try {
            String status = json.readTree(value).path("status").asText();
            return Set.of("TODO", "IN_PROGRESS", "REVIEW", "DONE").contains(status) ? status : null;
        } catch (Exception ignored) { return null; }
    }
    private String decision(String action) {
        if (action.contains("REQUEST_CHANGES") || action.contains("CHANGES_REQUESTED")) return "CHANGES_REQUESTED";
        if (action.contains("ACCEPT")) return "ACCEPTED";
        if (action.contains("REJECT")) return "REJECTED";
        if (action.contains("SUBMITTED")) return "SUBMITTED";
        return null;
    }
    private static String workspace(SubProject row) { return row.workspaceId() == null ? null : "/management/workspaces/" + row.workspaceId(); }
    static String milestoneLink(SubProject row, UUID milestone) {
        return row.teamId() == null ? "/projects/" + row.id() + "/milestones/" + milestone
                : "/teams/" + row.teamId() + "/milestones/" + milestone + (row.workspaceId() == null ? "" : "?workspaceId=" + row.workspaceId());
    }
}
