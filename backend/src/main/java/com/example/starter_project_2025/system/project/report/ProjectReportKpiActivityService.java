package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.alert.AlertExternalContributions;
import com.example.starter_project_2025.system.project.alert.ProjectAlertAccess;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.task.reminder.MemberReminderSettings;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;

/** Inactivity credits the actor of work changes, never the assignee or a dashboard page view. */
@Service
@RequiredArgsConstructor
public class ProjectReportKpiActivityService {
    public record InactiveSignal(Long userId, String name, Set<Long> teamIds) { }
    private final EntityManager em;
    private final ProjectAlertAccess access;
    private final MemberReminderSettings settings;
    private final AlertExternalContributions external;

    public long inactiveMembers(ProjectReportQueryRepository.Source source, Set<Long> projects,
                                Collection<SprintBacklog> items, Long tenant, Instant now) {
        return inactiveSignals(source, projects, items, tenant, now).size();
    }

    public List<InactiveSignal> inactiveSignals(ProjectReportQueryRepository.Source source, Set<Long> projects,
                                               Collection<SprintBacklog> items, Long tenant, Instant now) {
        Set<Long> teamIds = projects.stream().map(source.entries()::get).map(ProjectReportQueryRepository::effectiveTeam)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (teamIds.isEmpty()) return List.of();
        var members = em.createQuery("select m from ProjectMember m join fetch m.team t join fetch m.classMember cm "
                        + "join fetch cm.user u where t.id in :teams and t.trainingClass.tenantId=:tenant", ProjectMember.class)
                .setParameter("teams", teamIds).setParameter("tenant", tenant).getResultList().stream()
                .filter(access::current).filter(m -> !Boolean.TRUE.equals(m.getClassMember().getUser().getLocked()))
                .filter(m -> m.getClassMember().getUser().getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && Set.of("STUDENT", "TRAINEE").contains(role.getName()))).toList();
        if (members.isEmpty()) return List.of();
        Map<Long,Instant> latest = new HashMap<>();
        Map<UUID,Long> actors = new HashMap<>();
        for (var member : members) {
            var user = member.getClassMember().getUser();
            if (member.getCreatedAt() == null) continue; // Unknown join time cannot establish seven days of inactivity.
            credit(latest, user.getId(), member.getCreatedAt().atZone(settings.auditZone()).toInstant(), now);
            actors.put(UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)), user.getId());
        }
        Instant cutoff = now.minus(settings.inactiveWindow());
        LocalDateTime from = LocalDateTime.ofInstant(cutoff, settings.auditZone());
        LocalDateTime to = LocalDateTime.ofInstant(now, settings.auditZone());
        Set<Long> users = new HashSet<>(latest.keySet());
        if (users.isEmpty()) return List.of();

        // A recent move into the team resets the inactivity window.
        for (Object[] event : em.createQuery("select h.toTeamId,h.memberId,h.createdAt from ProjectTeamMemberHistory h "
                        + "where h.toTeamId in :teams and h.createdAt>=:from and h.createdAt<=:to", Object[].class)
                .setParameter("teams", teamIds).setParameter("from", from).setParameter("to", to).getResultList()) {
            members.stream().filter(m -> Objects.equals(m.getTeam().getId(), event[0]) && Objects.equals(m.getClassMember().getId(), event[1]))
                    .forEach(m -> credit(latest, m.getClassMember().getUser().getId(), instant(event[2]), now));
        }
        for (Object[] event : em.createQuery("select a.actorId,max(a.occurredAt) from ProjectActivityLog a "
                        + "where a.projectId in :projects and a.actorId in :users and a.occurredAt>=:from and a.occurredAt<=:to "
                        + "group by a.actorId", Object[].class)
                .setParameter("projects", projects).setParameter("users", users).setParameter("from", from).setParameter("to", to).getResultList())
            credit(latest, (Long) event[0], instant(event[1]), now);
        if (!items.isEmpty()) {
            var itemIds = items.stream().map(SprintBacklog::getId).toList();
            for (Object[] event : em.createQuery("select a.actorId,max(a.createdAt) from BacklogItemAuditLog a "
                            + "where a.sprintBacklogId in :items and a.actorId in :users and a.createdAt>=:from and a.createdAt<=:to "
                            + "group by a.actorId", Object[].class)
                    .setParameter("items", itemIds).setParameter("users", users).setParameter("from", from).setParameter("to", to).getResultList())
                credit(latest, (Long) event[0], instant(event[1]), now);
            for (Object[] event : em.createQuery("select a.actorId,max(a.occurredAt) from TaskAuditLog a,ProjectTask t,TaskAlertProjectLink p "
                            + "where a.taskId=t.id and a.projectId=t.projectId and t.projectId=p.id and p.tenantId=:tenant "
                            + "and p.projectId in :projects and t.backlogItem.id in :items and a.actorId in :users "
                            + "and a.occurredAt>=:from and a.occurredAt<=:to group by a.actorId", Object[].class)
                    .setParameter("tenant", tenant).setParameter("projects", projects).setParameter("items", itemIds)
                    .setParameter("users", users).setParameter("from", from).setParameter("to", to).getResultList())
                credit(latest, (Long) event[0], instant(event[1]), now);
        }
        for (Object[] event : em.createQuery("select a.actorId,max(a.createdAt) from MilestoneAuditLog a "
                        + "where a.tenantId=:tenant and a.projectId in :projects and a.actorId in :actors "
                        + "and a.createdAt>=:from and a.createdAt<=:to group by a.actorId", Object[].class)
                .setParameter("tenant", tenant).setParameter("projects", projects).setParameter("actors", actors.keySet())
                .setParameter("from", cutoff).setParameter("to", now).getResultList())
            credit(latest, actors.get(event[0]), (Instant) event[1], now);
        for (Object[] event : em.createQuery("select s.submitterId,max(s.submittedAt) from MilestoneArtifactSubmission s "
                        + "where s.tenantId=:tenant and s.projectId in :projects and s.submitterId in :actors "
                        + "and s.submittedAt>=:from and s.submittedAt<=:to group by s.submitterId", Object[].class)
                .setParameter("tenant", tenant).setParameter("projects", projects).setParameter("actors", actors.keySet())
                .setParameter("from", cutoff).setParameter("to", now).getResultList())
            credit(latest, actors.get(event[0]), (Instant) event[1], now);
        for (Long project : projects) {
            Long team = ProjectReportQueryRepository.effectiveTeam(source.entries().get(project));
            if (team != null) external.latest(team, project, users, now).forEach((user, at) -> credit(latest, user, at, now));
        }
        return latest.entrySet().stream().filter(entry -> users.contains(entry.getKey()) && !entry.getValue().isAfter(cutoff))
                .sorted(Map.Entry.comparingByKey()).map(entry -> {
                    var memberships = members.stream().filter(member -> member.getClassMember().getUser().getId().equals(entry.getKey())).toList();
                    var user = memberships.getFirst().getClassMember().getUser();
                    return new InactiveSignal(user.getId(), user.getFullName(), memberships.stream().map(member -> member.getTeam().getId()).collect(Collectors.toSet()));
                }).toList();
    }

    private Instant instant(Object value) { return ((LocalDateTime) value).atZone(settings.auditZone()).toInstant(); }
    private void credit(Map<Long,Instant> latest, Long user, Instant at, Instant now) {
        if (user != null && at != null && !at.isAfter(now)) latest.merge(user, at, (a, b) -> a.isAfter(b) ? a : b);
    }
}
