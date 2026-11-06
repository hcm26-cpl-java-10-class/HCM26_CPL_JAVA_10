package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** Scoped, batched reads. Tasks and submissions are aggregated separately to avoid join multiplication. */
@Repository
@RequiredArgsConstructor
public class ProjectReportQueryRepository {
    public record TaskCount(long done, long total) { public static TaskCount empty() { return new TaskCount(0,0); } }
    public record Submitted(Instant latestAt, boolean late) { }
    public record Source(List<ProjectTeam> teams, List<Milestone> milestones,
                         Map<UUID,TaskCount> milestoneTasks, Map<Long,TaskCount> projectTasks,
                         Map<UUID,Submitted> submissions, Map<Long,ProjectTemplateSnapshot> snapshots,
                         Map<Long,String> mentors, Map<Long,Long> workspaces) { }
    private final EntityManager em;
    private final ProjectReportScopeService scope;
    private final ObjectMapper json;

    public Source load(ProjectReportScopeService.Actor actor) {
        List<ProjectTeam> teams = scope.teams(actor);
        if (teams.isEmpty()) return new Source(List.of(),List.of(),Map.of(),Map.of(),Map.of(),Map.of(),Map.of(),Map.of());
        Map<Long,ProjectTeam> projects = teams.stream().collect(Collectors.toMap(ProjectTeam::getProjectId,Function.identity()));
        List<Milestone> milestones = em.createQuery("select m from Milestone m where m.tenantId=:tenant and m.active=true and m.projectId in :projects",Milestone.class)
                .setParameter("tenant",actor.tenantId()).setParameter("projects",projects.keySet()).getResultList().stream()
                .filter(m -> projects.get(m.getProjectId()).getId().equals(m.getTeamId())).toList();
        Map<UUID,TaskCount> milestoneTasks = new HashMap<>();
        Map<UUID,Submitted> submissions = new HashMap<>();
        if (!milestones.isEmpty()) {
            Set<UUID> ids = milestones.stream().map(Milestone::getId).collect(Collectors.toSet());
            for (Object[] row : em.createQuery("select m.id,count(b.id),sum(case when b.status=com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus.DONE then 1 else 0 end) "
                    + "from SprintBacklog b join b.milestone m left join b.sprint s where b.isActive=true and m.tenantId=:tenant and m.id in :ids "
                    + "and (b.projectId is null or b.projectId=m.projectId) and (s.id is null or ((s.projectId is null or s.projectId=m.projectId) "
                    + "and (s.teamId is null or s.teamId=m.teamId))) group by m.id",Object[].class)
                    .setParameter("tenant",actor.tenantId()).setParameter("ids",ids).getResultList())
                milestoneTasks.put((UUID)row[0],new TaskCount(number(row[2]),number(row[1])));
            for (Object[] row : em.createQuery("select m.id,max(s.submittedAt),sum(case when s.submittedLate=true or s.submittedAt>m.deadline then 1 else 0 end) "
                    + "from MilestoneArtifactSubmission s, Milestone m where s.milestoneId=m.id and s.tenantId=:tenant and m.tenantId=:tenant "
                    + "and m.id in :ids and s.teamId=m.teamId and (s.projectId is null or s.projectId=m.projectId) group by m.id",Object[].class)
                    .setParameter("tenant",actor.tenantId()).setParameter("ids",ids).getResultList())
                submissions.put((UUID)row[0],new Submitted((Instant)row[1],number(row[2])>0));
        }
        Map<Long,TaskCount> projectTasks = new HashMap<>();
        for (Object[] row : em.createQuery("select p.id,count(b.id),sum(case when b.status=com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus.DONE then 1 else 0 end) "
                + "from SprintBacklog b left join b.sprint s, Project p where b.isActive=true and p.id=coalesce(b.projectId,s.projectId) "
                + "and p.tenantId=:tenant and p.id in :projects and (s.id is null or ((s.projectId is null or s.projectId=p.id) "
                + "and (s.teamId is null or s.teamId=p.teamId))) group by p.id",Object[].class)
                .setParameter("tenant",actor.tenantId()).setParameter("projects",projects.keySet()).getResultList())
            projectTasks.put((Long)row[0],new TaskCount(number(row[2]),number(row[1])));
        Map<Long,ProjectTemplateSnapshot> snapshots = snapshots(teams,actor.tenantId());
        Map<Long,String> mentors = new HashMap<>();
        Set<Long> mentorIds = teams.stream().map(ProjectTeam::getAssignedMentorId).filter(java.util.Objects::nonNull).collect(Collectors.toSet());
        if (!mentorIds.isEmpty()) for (Object[] row : em.createQuery("select u.id,u.firstName,u.lastName from User u where u.tenantId=:tenant and u.id in :ids",Object[].class)
                .setParameter("tenant",actor.tenantId()).setParameter("ids",mentorIds).getResultList())
            mentors.put((Long)row[0],String.valueOf(row[1])+(row[2]==null?"":" "+row[2]));
        Map<Long,Long> workspaces = new HashMap<>();
        for (Object[] row : em.createQuery("select w.team.id,w.id from Workspace w where w.tenant.id=:tenant and w.isActive=true and w.team.id in :teams",Object[].class)
                .setParameter("tenant",actor.tenantId()).setParameter("teams",teams.stream().map(ProjectTeam::getId).toList()).getResultList())
            workspaces.put((Long)row[0],(Long)row[1]);
        return new Source(teams,milestones,milestoneTasks,projectTasks,submissions,snapshots,mentors,workspaces);
    }

    private Map<Long,ProjectTemplateSnapshot> snapshots(List<ProjectTeam> teams,Long tenantId) {
        Set<Long> ids = new HashSet<>();
        teams.forEach(t -> { if(t.getProject().getTemplateSnapshotId()!=null)ids.add(t.getProject().getTemplateSnapshotId());
            if(t.getProjectTemplateVersionId()!=null)ids.add(t.getProjectTemplateVersionId()); });
        Map<Long,ProjectTemplateSnapshot> result = new HashMap<>();
        readSnapshots(ids,tenantId).forEach(snapshot -> result.put(snapshot.getId(),snapshot));
        Set<Long> sources = new HashSet<>();
        result.values().forEach(snapshot -> { Long source=sourceVersionId(snapshot); if(source!=null&&!result.containsKey(source))sources.add(source); });
        readSnapshots(sources,tenantId).forEach(snapshot -> result.put(snapshot.getId(),snapshot));
        return result;
    }
    private List<ProjectTemplateSnapshot> readSnapshots(Collection<Long> ids,Long tenantId) {
        return ids.isEmpty()?List.of():em.createQuery("select s from ProjectTemplateSnapshot s join s.template t where s.id in :ids "
                        +"and (t.tenantId is null or t.tenantId=:tenant)",ProjectTemplateSnapshot.class)
                .setParameter("ids",ids).setParameter("tenant",tenantId).getResultList();
    }
    public Long sourceVersionId(ProjectTemplateSnapshot snapshot) {
        if (snapshot==null) return null;
        try {
            var content=json.readTree(snapshot.getContentJson());
            if (content.path("sourceSnapshotId").isIntegralNumber()) return content.get("sourceSnapshotId").asLong();
            if ("TEAM_ASSIGNMENT".equals(content.path("purpose").asText())) return snapshot.getParentTemplateId();
        } catch(Exception legacyContent) { /* Legacy published snapshots may have no structured content. */ }
        // A published version may itself have a parent because it was cloned from an earlier version.
        // Only assignment copies resolve to that parent; the published v2 must remain separate from v1.
        return snapshot.getId();
    }
    private long number(Object value) { return value==null?0:((Number)value).longValue(); }
}
