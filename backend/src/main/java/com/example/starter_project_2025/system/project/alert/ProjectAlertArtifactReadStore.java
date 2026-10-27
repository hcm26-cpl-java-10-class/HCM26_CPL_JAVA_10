package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.SubmissionSummary;

/** Reads UFR-PRJ-006 records directly; receipt of a version is never acceptance. */
@Repository
@RequiredArgsConstructor
public class ProjectAlertArtifactReadStore {
    private final EntityManager em;

    public Map<UUID, SubmissionSummary> summaries(Collection<Milestone> milestones, Instant now) {
        if (milestones.isEmpty()) return Map.of();
        Set<Long> teams = new HashSet<>();
        Set<UUID> ids = new HashSet<>();
        milestones.forEach(m -> { teams.add(m.getTeamId()); ids.add(m.getId()); });
        var submissions = em.createQuery("select s from MilestoneArtifactSubmission s, Milestone m "
                + "where m.id=s.milestoneId and m.id in :ids and s.tenantId=m.tenantId "
                + "and m.teamId in :teams and m.active=true and s.submittedAt<=:now and "
                + "((s.teamId=m.teamId and (s.projectId is null or s.projectId=m.projectId)) "
                + "or (s.teamId is null and s.projectId=m.projectId)) "
                + "order by s.submittedAt desc,s.version desc,s.id", MilestoneArtifactSubmission.class)
                .setParameter("ids", ids).setParameter("teams", teams)
                .setParameter("now", now).getResultList();
        Map<UUID, SubmissionSummary> result = new HashMap<>();
        for (var row : submissions) {
            var previous = result.get(row.getMilestoneId());
            result.put(row.getMilestoneId(), previous == null
                    ? new SubmissionSummary("SUBMITTED", 1, row.getVersion(), row.getSubmittedAt(), row.isSubmittedLate(), "NOT_AVAILABLE")
                    : new SubmissionSummary(previous.status(), previous.versionCount()+1, previous.latestVersion(),
                            previous.submittedAt(), previous.submittedLate(), previous.acceptanceStatus()));
        }
        return result;
    }

    public Map<Long, Instant> contributions(ProjectTeam team, Collection<User> users, Instant now) {
        if (users.isEmpty()) return Map.of();
        Long tenantId = team.getTrainingClass().getTenantId();
        Map<UUID, Long> actors = new HashMap<>();
        users.stream().filter(user -> tenantId.equals(user.getTenantId())).forEach(user -> actors.put(
                UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)), user.getId()));
        if (actors.isEmpty()) return Map.of();
        Map<Long, Instant> latest = new HashMap<>();
        var submissions = em.createQuery("select s from MilestoneArtifactSubmission s, Milestone m "
                + "where m.id=s.milestoneId and m.tenantId=:tenant and s.tenantId=:tenant and m.teamId=:team "
                + "and s.submitterId in :actors and s.submittedAt<=:now and "
                + "((s.teamId=:team and (s.projectId is null or s.projectId=m.projectId)) "
                + "or (s.teamId is null and s.projectId=m.projectId))", MilestoneArtifactSubmission.class)
                .setParameter("tenant",tenantId).setParameter("team",team.getId()).setParameter("actors",actors.keySet())
                .setParameter("now",now).getResultList();
        submissions.forEach(row -> merge(latest,actors.get(row.getSubmitterId()),row.getSubmittedAt()));
        // Draft changes count as contribution; viewing, reviewing and alerting do not.
        var audits = em.createQuery("select a from MilestoneAuditLog a, Milestone m "
                + "where m.id=a.milestoneId and m.tenantId=:tenant and a.tenantId=:tenant and m.teamId=:team "
                + "and (a.projectId=m.projectId or a.projectId is null) and a.actorId in :actors and a.createdAt<=:now "
                + "and a.action in ('ARTIFACT_SUBMITTED','ARTIFACT_DRAFT_SAVED','ARTIFACT_UPDATED')",MilestoneAuditLog.class)
                .setParameter("tenant",tenantId).setParameter("team",team.getId()).setParameter("actors",actors.keySet())
                .setParameter("now",now).getResultList();
        audits.forEach(row -> merge(latest,actors.get(row.getActorId()),row.getCreatedAt()));
        return latest;
    }

    private void merge(Map<Long,Instant> values, Long actor, Instant at) {
        if (actor != null && at != null) values.merge(actor,at,(a,b)->a.isAfter(b)?a:b);
    }
}
