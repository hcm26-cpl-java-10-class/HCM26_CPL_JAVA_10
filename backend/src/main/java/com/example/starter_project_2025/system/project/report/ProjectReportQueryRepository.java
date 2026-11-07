package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignment;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.*;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.BacklogCounts;

/** Load authorized projects first, then their ancestor context. Never expand into unauthorized siblings. */
@Repository
@RequiredArgsConstructor
public class ProjectReportQueryRepository {
    public record Submitted(Instant latestAt, boolean late) { }
    public record Entry(Project project, Project root, ProjectTeam owner, TrainingClass school,
                        int depth, boolean contextOnly, Long workspaceId) { }
    public record Source(List<ProjectTeam> teams, Map<Long,Entry> entries,
                         Map<Long,List<SprintBacklog>> backlogs, Map<Long,List<Milestone>> milestones,
                         Map<UUID,Submitted> submissions, Map<Long,ProjectTemplateSnapshot> snapshots,
                         Map<Long,String> mentors) { }
    private final EntityManager em;
    private final ProjectReportScopeService scope;
    private final ObjectMapper json;

    public Source load(ProjectReportScopeService.Actor actor) {
        List<ProjectTeam> teams = scope.teams(actor);
        if (teams.isEmpty()) return new Source(teams,Map.of(),Map.of(),Map.of(),Map.of(),Map.of(),Map.of());
        Map<Long,ProjectTeam> byTeam = new HashMap<>();
        Map<Long,ProjectTeam> primary = new HashMap<>();
        teams.forEach(team -> { byTeam.put(team.getId(),team); if(team.getProjectId()!=null) primary.put(team.getProjectId(),team); });
        Set<Long> primaryIds = primary.isEmpty()?Set.of(-1L):primary.keySet();
        var owned = em.createQuery("select distinct p from Project p left join fetch p.parentProject "
                + "where p.tenantId=:tenant and p.isActive=true and (p.teamId in :teams or p.id in :primary "
                + "or exists(select a.id from TeamSubprojectAssignment a where a.project.id=p.id "
                + "and a.team.id in :teams and a.isActive=true))",Project.class)
                .setParameter("tenant",actor.tenantId()).setParameter("teams",byTeam.keySet())
                .setParameter("primary",primaryIds).getResultList();
        var mappings = em.createQuery("select a from TeamSubprojectAssignment a join fetch a.project "
                + "where a.team.id in :teams and a.isActive=true and a.project.tenantId=:tenant "
                + "and a.project.isActive=true",TeamSubprojectAssignment.class)
                .setParameter("teams",byTeam.keySet()).setParameter("tenant",actor.tenantId()).getResultList();
        Map<Long,ProjectTeam> owners = new HashMap<>(primary);
        mappings.forEach(mapping -> owners.put(mapping.getProject().getId(),byTeam.get(mapping.getTeam().getId())));
        owned.forEach(project -> { if(byTeam.containsKey(project.getTeamId())) owners.put(project.getId(),byTeam.get(project.getTeamId())); });

        Map<Long,Long> workspaceByProject = new HashMap<>();
        var spaces = em.createQuery("select w from Workspace w where w.tenant.id=:tenant and w.isActive=true "
                + "and w.team.id in :teams order by w.id desc",Workspace.class)
                .setParameter("tenant",actor.tenantId()).setParameter("teams",byTeam.keySet()).getResultList();
        Set<Long> workspaceIds = new HashSet<>();
        spaces.forEach(workspace -> { workspaceIds.add(workspace.getId()); if(workspace.getProject()!=null)
            workspaceByProject.putIfAbsent(workspace.getProject().getId(),workspace.getId()); });
        mappings.forEach(mapping -> { if(workspaceIds.contains(mapping.getWorkspaceId()))
            workspaceByProject.putIfAbsent(mapping.getProject().getId(),mapping.getWorkspaceId()); });

        Map<Long,Entry> entries = new LinkedHashMap<>();
        for (Project project : owned) {
            ProjectTeam owner = owners.get(project.getId());
            if (owner == null) continue;
            TrainingClass school = owner.getTrainingClass();
            List<Project> chain = ancestors(project, actor.tenantId(), school.getId());
            if (chain.isEmpty()) continue;
            Project root = chain.getLast();
            for (int index=chain.size()-1; index>=0; index--) {
                Project item = chain.get(index);
                ProjectTeam itemOwner = owners.get(item.getId());
                boolean sharedMaster = item.getId().equals(root.getId()) && item.getTeamId()==null && item.getAssignmentId()!=null;
                boolean contextOnly = itemOwner==null && !sharedMaster;
                entries.putIfAbsent(item.getId(),new Entry(item,root,itemOwner,school,chain.size()-1-index,
                        contextOnly,workspaceByProject.get(item.getId())));
            }
        }
        Set<Long> readable = new HashSet<>();
        entries.values().stream().filter(entry -> !entry.contextOnly()).forEach(entry -> readable.add(entry.project().getId()));
        if (readable.isEmpty()) return new Source(teams,entries,Map.of(),Map.of(),Map.of(),Map.of(),Map.of());
        Map<Long,List<Milestone>> milestones = new HashMap<>();
        em.createQuery("select m from Milestone m where m.tenantId=:tenant and m.active=true and m.projectId in :projects",Milestone.class)
                .setParameter("tenant",actor.tenantId()).setParameter("projects",readable).getResultList().stream()
                .filter(m -> Objects.equals(m.getTeamId(),effectiveTeam(entries.get(m.getProjectId()))))
                .forEach(m -> milestones.computeIfAbsent(m.getProjectId(),ignored -> new ArrayList<>()).add(m));
        Map<Long,List<SprintBacklog>> backlogs = new HashMap<>();
        var items = em.createQuery("select b from SprintBacklog b left join fetch b.sprint s left join fetch b.milestone m "
                + "where b.isActive=true and coalesce(b.projectId,s.projectId,m.projectId) in :projects",SprintBacklog.class)
                .setParameter("projects",readable).getResultList();
        for (SprintBacklog item : items) {
            Long projectId = projectId(item);
            Entry entry = entries.get(projectId);
            if (entry==null || entry.contextOnly()) continue;
            var sprint = item.getSprint();
            if (sprint!=null && (!Boolean.TRUE.equals(sprint.getIsActive())
                    || sprint.getProjectId()!=null && !projectId.equals(sprint.getProjectId())
                    || sprint.getTeamId()!=null && !Objects.equals(sprint.getTeamId(),effectiveTeam(entry)))) continue;
            var milestone = item.getMilestone();
            if (milestone!=null && (!actor.tenantId().equals(milestone.getTenantId())
                    || !projectId.equals(milestone.getProjectId()) || !Objects.equals(milestone.getTeamId(),effectiveTeam(entry)))) continue;
            backlogs.computeIfAbsent(projectId,ignored -> new ArrayList<>()).add(item);
        }
        Set<UUID> milestoneIds = new HashSet<>();
        milestones.values().forEach(values -> values.forEach(m -> milestoneIds.add(m.getId())));
        Map<UUID,Submitted> submissions = new HashMap<>();
        if(!milestoneIds.isEmpty()) for(Object[] row : em.createQuery("select m.id,max(s.submittedAt),"
                + "sum(case when s.submittedLate=true or s.submittedAt>m.deadline then 1 else 0 end) "
                + "from MilestoneArtifactSubmission s,Milestone m where s.milestoneId=m.id and s.tenantId=:tenant "
                + "and m.tenantId=:tenant and m.id in :ids and (s.teamId=m.teamId or (s.teamId is null and m.teamId is null)) "
                + "and (s.projectId is null or s.projectId=m.projectId) group by m.id",Object[].class)
                .setParameter("tenant",actor.tenantId()).setParameter("ids",milestoneIds).getResultList())
            submissions.put((UUID)row[0],new Submitted((Instant)row[1],number(row[2])>0));

        Set<Long> snapshotIds = new HashSet<>(), mentorIds = new HashSet<>();
        entries.values().forEach(entry -> {
            if(entry.project().getTemplateSnapshotId()!=null) snapshotIds.add(entry.project().getTemplateSnapshotId());
            ProjectTeam owner=entry.owner();
            if(owner!=null && owner.getProjectTemplateVersionId()!=null) snapshotIds.add(owner.getProjectTemplateVersionId());
            Long mentor=owner==null?entry.school().getMentorId():owner.getAssignedMentorId();
            if(mentor!=null) mentorIds.add(mentor);
        });
        Map<Long,ProjectTemplateSnapshot> snapshots = new HashMap<>();
        readSnapshots(snapshotIds,actor.tenantId()).forEach(value -> snapshots.put(value.getId(),value));
        Set<Long> sources = new HashSet<>();
        snapshots.values().forEach(value -> { Long id=sourceVersionId(value); if(id!=null&&!snapshots.containsKey(id))sources.add(id); });
        readSnapshots(sources,actor.tenantId()).forEach(value -> snapshots.put(value.getId(),value));
        Map<Long,String> mentors=new HashMap<>();
        if(!mentorIds.isEmpty()) for(Object[] row:em.createQuery("select u.id,u.firstName,u.lastName from User u "
                + "where u.tenantId=:tenant and u.id in :ids",Object[].class)
                .setParameter("tenant",actor.tenantId()).setParameter("ids",mentorIds).getResultList())
            mentors.put((Long)row[0],(row[1]+" "+Objects.toString(row[2],"")).strip());
        return new Source(teams,entries,backlogs,milestones,submissions,snapshots,mentors);
    }

    private List<Project> ancestors(Project project,Long tenantId,Long classId) {
        var result=new ArrayList<Project>();Set<Long> visited=new HashSet<>();
        for(Project current=project;current!=null;current=current.getParentProject()) {
            if(!visited.add(current.getId()) || !tenantId.equals(current.getTenantId()) || !Boolean.TRUE.equals(current.getIsActive())
                    || current.getClassId()!=null&&!classId.equals(current.getClassId())) return List.of();
            result.add(current);
        }
        return result;
    }
    public static Long effectiveTeam(Entry entry) {
        return entry.project().getTeamId()!=null?entry.project().getTeamId():entry.owner()==null?null:entry.owner().getId();
    }
    public static Long projectId(SprintBacklog item) {
        return item.getProjectId()!=null?item.getProjectId():item.getSprint()!=null&&item.getSprint().getProjectId()!=null
                ?item.getSprint().getProjectId():item.getMilestone()==null?null:item.getMilestone().getProjectId();
    }
    public static BacklogCounts counts(Collection<SprintBacklog> items) {
        long todo=0,inProgress=0,review=0,done=0,other=0;
        for(var item:items) {
            if(item.getStatus()==null){other++;continue;}
            switch(item.getStatus()){case TODO->todo++;case IN_PROGRESS->inProgress++;case REVIEW->review++;case DONE->done++;}
        }
        return new BacklogCounts(todo,inProgress,review,done,other);
    }
    private List<ProjectTemplateSnapshot> readSnapshots(Collection<Long> ids,Long tenantId) {
        return ids.isEmpty()?List.of():em.createQuery("select s from ProjectTemplateSnapshot s join s.template t where s.id in :ids "
                +"and (t.tenantId is null or t.tenantId=:tenant)",ProjectTemplateSnapshot.class)
                .setParameter("ids",ids).setParameter("tenant",tenantId).getResultList();
    }
    public Long sourceVersionId(ProjectTemplateSnapshot snapshot) {
        if(snapshot==null)return null;
        try {
            var content=json.readTree(snapshot.getContentJson());
            if(content.path("sourceSnapshotId").isIntegralNumber())return content.get("sourceSnapshotId").asLong();
            if("TEAM_ASSIGNMENT".equals(content.path("purpose").asText()))return snapshot.getParentTemplateId();
        }catch(Exception legacyContent){ /* Keep unstructured source versions usable. */ }
        return snapshot.getId();
    }
    private long number(Object value){return value==null?0:((Number)value).longValue();}
}
