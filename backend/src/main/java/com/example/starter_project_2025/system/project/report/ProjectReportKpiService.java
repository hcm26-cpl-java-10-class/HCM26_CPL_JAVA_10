package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.submission.domain.*;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

/** Current operational KPIs, computed from authorized matching rows before pagination. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectReportKpiService {
    public record Result(Overview overview, List<DeliveryRow> deliveries, List<RiskRow> risks) { }
    private final EntityManager em;
    private final ProjectReportSettings settings;
    private final ProjectReportKpiActivityService activity;

    public Overview overview(ProjectReportService.Snapshot snapshot) { return evaluate(snapshot).overview(); }

    public Result evaluate(ProjectReportService.Snapshot snapshot) {
        Map<String,Long> milestones = zeros("PLANNED", "IN_PROGRESS", "SUBMITTED", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED", "WAIVED");
        Map<String,Long> artifacts = zeros("DRAFT", "SUBMITTED", "ACCEPTED", "CHANGES_REQUESTED", "REJECTED");
        Long tenant = snapshot.actor().tenantId();
        Instant now = snapshot.asOf();
        var source = snapshot.source();
        var running = snapshot.matching().stream()
                .filter(row -> !row.contextOnly() && row.status() == Status.ACTIVE && row.masterStatus() == Status.ACTIVE).toList();
        Set<Long> workspaceIds = running.stream().map(SubProject::workspaceId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> activeSpaces = workspaceIds.isEmpty() ? Set.of() : new HashSet<>(em.createQuery(
                "select w.id from Workspace w where w.id in :ids and w.tenant.id=:tenant and w.isActive=true "
                        + "and w.status=com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus.ACTIVE "
                        + "and w.currentSlot is not null and w.team.isActive=true "
                        + "and w.team.status=com.example.starter_project_2025.system.project.ProjectTeamStatus.ACTIVE", Long.class)
                .setParameter("ids", workspaceIds).setParameter("tenant", tenant).getResultList());
        // An active Project without a workspace still contributes to the project count. Historical
        // workspaces do not. A shared Master can have work in its participating teams' workspaces.
        var active = running.stream().filter(row -> row.workspaceId() == null || activeSpaces.contains(row.workspaceId())).toList();
        long masters = active.stream().map(SubProject::masterId).distinct().count();
        long teams = active.stream().map(SubProject::teamId).filter(Objects::nonNull).distinct().count();
        Set<Long> workspaceMasters = active.stream().filter(row -> row.workspaceId() != null && activeSpaces.contains(row.workspaceId()))
                .map(SubProject::masterId).collect(Collectors.toSet());
        Set<Long> projects = active.stream().filter(row -> row.workspaceId() != null && activeSpaces.contains(row.workspaceId())
                        || row.id().equals(row.masterId()) && row.teamId() == null && workspaceMasters.contains(row.masterId()))
                .map(SubProject::id).collect(Collectors.toSet());
        if (projects.isEmpty()) return new Result(new Overview(masters, teams, milestones, artifacts, 0, 0, 0, 0), List.of(), List.of());

        Map<UUID,Milestone> stages = new LinkedHashMap<>();
        projects.forEach(id -> source.milestones().getOrDefault(id, List.of()).forEach(stage -> stages.put(stage.getId(), stage)));
        Set<UUID> waived = waivers(tenant, stages);
        Map<UUID,MilestoneSubmission> submissions = new HashMap<>();
        Map<UUID,String> latest = artifactStates(tenant, stages, source, submissions);
        Map<UUID,MilestoneArtifactSubmission> legacy = new HashMap<>();
        if (!stages.isEmpty()) for (var artifact : em.createQuery("select a from MilestoneArtifactSubmission a where a.tenantId=:tenant "
                        + "and a.milestoneId in :ids order by a.submittedAt desc,a.version desc,a.id", MilestoneArtifactSubmission.class)
                .setParameter("tenant", tenant).setParameter("ids", stages.keySet()).getResultList()) {
            var stage = stages.get(artifact.getMilestoneId());
            if (sameScope(stage, artifact.getProjectId(), artifact.getTeamId())) legacy.putIfAbsent(stage.getId(), artifact);
        }
        Map<UUID,SubmissionVersion> versions = new HashMap<>();
        if (!submissions.isEmpty()) for (var version : em.createQuery("select v from SubmissionVersion v join fetch v.submission s "
                        + "where s.tenantId=:tenant and s.id in :ids and v.versionNumber=s.currentVersionNumber", SubmissionVersion.class)
                .setParameter("tenant", tenant).setParameter("ids", submissions.values().stream().map(MilestoneSubmission::getId).toList()).getResultList())
            versions.put(version.getSubmission().getMilestone().getId(), version);
        Map<Long,SubProject> rows = snapshot.matching().stream().collect(Collectors.toMap(SubProject::id, row -> row));
        List<DeliveryRow> deliveries = new ArrayList<>();
        List<RiskRow> riskRows = new ArrayList<>();
        long milestoneRisks = 0;
        for (Milestone stage : stages.values()) {
            String artifact = latest.get(stage.getId());
            String state = waived.contains(stage.getId()) ? "WAIVED" : stage.lifecycleStatus().name();
            if (!waived.contains(stage.getId()) && artifact != null && !artifact.equals("DRAFT")) state = artifact;
            milestones.merge(state, 1L, Long::sum);
            if (artifact != null) artifacts.merge(artifact, 1L, Long::sum);
            boolean risk = milestoneRisk(stage, artifact, waived.contains(stage.getId()), now);
            if (risk) milestoneRisks++;
            var row = rows.get(stage.getProjectId());
            var submission = submissions.get(stage.getId());
            var version = versions.get(stage.getId());
            boolean currentSubmission = submission != null && Objects.equals(artifact, submission.getStatus().name());
            var legacyArtifact = legacy.get(stage.getId());
            Integer versionNumber = null;
            if (currentSubmission) versionNumber = submission.getCurrentVersionNumber();
            else if (submission == null && legacyArtifact != null && !"DRAFT".equals(artifact)) versionNumber = Math.toIntExact(legacyArtifact.getVersion());
            String attention = !risk ? "NONE" : Set.of("REJECTED", "CHANGES_REQUESTED").contains(state) ? "REVISION"
                    : stage.getDeadline() != null && stage.getDeadline().isBefore(now) ? "OVERDUE" : "DUE_SOON";
            int checklistTotal = version == null ? stage.getChecklistItems().size() : version.getChecklist().size();
            int checklistDone = version == null ? (int) stage.getChecklistItems().stream().filter(item -> item.isCompleted()).count()
                    : (int) version.getChecklist().stream().filter(item -> item.isCompleted()).count();
            deliveries.add(new DeliveryRow(stage.getId(), stage.getTitle(), row.id(), row.code(), row.name(), row.masterId(),
                    row.masterName(), row.teamId(), row.teamName(), stage.isMandatory(), state, artifact,
                    currentSubmission ? submission.getId() : null, versionNumber,
                    stage.getDeadline(), "DRAFT".equals(artifact) ? null : submission == null ? source.submissions().containsKey(stage.getId())
                    ? source.submissions().get(stage.getId()).latestAt() : null : submission.getSubmittedAt(),
                    submission == null ? null : submission.getAssignedReviewerName(), checklistDone, checklistTotal, attention));
            if (risk) riskRows.add(new RiskRow("milestone:" + stage.getId(), "MILESTONE", row.id(), row.name(), row.teamName(),
                    stage.getTitle(), stage.getDeadline(), attention));
        }

        Map<Long,SprintBacklog> items = new LinkedHashMap<>();
        projects.forEach(id -> source.backlogs().getOrDefault(id, List.of()).forEach(item -> items.put(item.getId(), item)));
        var overdueItems = items.values().stream().filter(item -> overdue(item, now)).toList();
        overdueItems.forEach(item -> {
            var row = rows.get(ProjectReportQueryRepository.projectId(item));
            riskRows.add(new RiskRow("backlog:" + item.getId(), "TASK", row.id(), row.name(), row.teamName(), item.getTitle(),
                    item.getEndDate().atZone(settings.zone()).toInstant(), "OVERDUE"));
        });
        var subtasks = overdueSubtasks(tenant, projects, items, rows, now);
        riskRows.addAll(subtasks);
        var inactive = activity.inactiveSignals(source, projects, items.values(), tenant, now);
        inactive.forEach(member -> {
            var contexts = rows.values().stream().filter(row -> member.teamIds().contains(row.teamId())).toList();
            riskRows.add(new RiskRow("member:" + member.userId(), "MEMBER", contexts.size() == 1 ? contexts.getFirst().id() : null,
                    contexts.stream().map(SubProject::name).distinct().sorted().collect(Collectors.joining(", ")),
                    contexts.stream().map(SubProject::teamName).filter(Objects::nonNull).distinct().sorted().collect(Collectors.joining(", ")),
                    member.name(), null, "INACTIVE"));
        });
        deliveries.sort(Comparator.comparing(DeliveryRow::deadline, Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(DeliveryRow::milestoneId));
        return new Result(new Overview(masters, teams, milestones, artifacts, overdueItems.size(), subtasks.size(), milestoneRisks, inactive.size()),
                List.copyOf(deliveries), List.copyOf(riskRows));
    }

    private Set<UUID> waivers(Long tenant, Map<UUID,Milestone> stages) {
        if (stages.isEmpty()) return Set.of();
        Set<UUID> result = new HashSet<>();
        for (var waiver : em.createQuery("select w from MilestoneWaiver w where w.tenantId=:tenant and w.milestoneId in :ids", MilestoneWaiver.class)
                .setParameter("tenant", tenant).setParameter("ids", stages.keySet()).getResultList()) {
            var stage = stages.get(waiver.getMilestoneId());
            if (Objects.equals(stage.getProjectId(), waiver.getProjectId()) && Objects.equals(stage.getTeamId(), waiver.getTeamId()))
                result.add(stage.getId());
        }
        return result;
    }

    private Map<UUID,String> artifactStates(Long tenant, Map<UUID,Milestone> stages, ProjectReportQueryRepository.Source source,
                                           Map<UUID,MilestoneSubmission> submissions) {
        Map<UUID,String> result = new HashMap<>();
        Map<UUID,Instant> updated = new HashMap<>();
        if (stages.isEmpty()) return result;
        // The aggregate's current version is the latest draft/submission and its current review state.
        // Reading it once avoids counting immutable artifact copies or historical review rounds twice.
        for (var row : em.createQuery("select s from MilestoneSubmission s join fetch s.milestone m "
                        + "where s.tenantId=:tenant and m.tenantId=:tenant and m.id in :ids", MilestoneSubmission.class)
                .setParameter("tenant", tenant).setParameter("ids", stages.keySet()).getResultList()) {
            var stage = stages.get(row.getMilestone().getId());
            if (sameScope(stage, row.getProjectId(), row.getTeamId())) {
                submissions.put(stage.getId(), row);
                result.put(stage.getId(), row.getStatus().name());
                updated.put(stage.getId(), row.getUpdatedAt());
            }
        }
        for (var stage : stages.values()) if (!result.containsKey(stage.getId()) && source.submissions().containsKey(stage.getId())) {
            String state = stage.lifecycleStatus().name();
            result.put(stage.getId(), Set.of("ACCEPTED", "REJECTED", "CHANGES_REQUESTED").contains(state) ? state : "SUBMITTED");
            updated.put(stage.getId(), source.submissions().get(stage.getId()).latestAt());
        }
        for (var draft : em.createQuery("select d from MilestoneArtifactDraft d where d.tenantId=:tenant and d.milestoneId in :ids", MilestoneArtifactDraft.class)
                .setParameter("tenant", tenant).setParameter("ids", stages.keySet()).getResultList()) {
            var stage = stages.get(draft.getMilestoneId());
            // The workspace draft writer predates team_id and may legitimately leave it null.
            // Its exact tenant/project/milestone tuple still has to match an authorized stage.
            if (!Objects.equals(stage.getProjectId(), draft.getProjectId())
                    || draft.getTeamId() != null && !Objects.equals(stage.getTeamId(), draft.getTeamId())) continue;
            Instant previous = updated.get(stage.getId());
            String state = result.get(stage.getId());
            if (state == null || !Set.of("ACCEPTED", "REJECTED").contains(state)
                    && draft.getUpdatedAt() != null && previous != null && draft.getUpdatedAt().isAfter(previous))
                result.put(stage.getId(), "DRAFT");
        }
        return result;
    }

    private boolean sameScope(Milestone stage, Long project, Long team) {
        return (project == null || Objects.equals(project, stage.getProjectId())) && Objects.equals(team, stage.getTeamId());
    }

    static boolean milestoneRisk(Milestone stage, String artifact, boolean waived, Instant now) {
        if (waived || stage.lifecycleStatus() == MilestoneLifecycleStatus.ACCEPTED || "ACCEPTED".equals(artifact)) return false;
        if (Set.of("REJECTED", "CHANGES_REQUESTED").contains(Objects.toString(artifact, ""))
                || stage.lifecycleStatus() == MilestoneLifecycleStatus.REJECTED
                || stage.lifecycleStatus() == MilestoneLifecycleStatus.CHANGES_REQUESTED) return true;
        Instant deadline = stage.getDeadline();
        if (deadline == null) return false;
        if (deadline.isBefore(now)) return true;
        boolean notSubmitted = artifact == null || artifact.equals("DRAFT");
        return notSubmitted && !deadline.isAfter(now.plus(Duration.ofHours(48)));
    }

    private boolean overdue(SprintBacklog item, Instant now) {
        return (item.getStatus() == SprintBacklogStatus.TODO || item.getStatus() == SprintBacklogStatus.IN_PROGRESS)
                && activeSprint(item) && item.getEndDate() != null && item.getEndDate().atZone(settings.zone()).toInstant().isBefore(now);
    }

    private boolean activeSprint(SprintBacklog item) {
        return item.getSprint() == null || Boolean.TRUE.equals(item.getSprint().getIsActive()) && item.getSprint().getStatus() == SprintStatus.ACTIVE;
    }

    private List<RiskRow> overdueSubtasks(Long tenant, Set<Long> projects, Map<Long,SprintBacklog> items,
                                         Map<Long,SubProject> rows, Instant now) {
        if (items.isEmpty()) return List.of();
        List<RiskRow> result = new ArrayList<>();
        for (Object[] row : em.createQuery("select t,p.projectId from ProjectTask t,TaskAlertProjectLink p "
                        + "where t.isActive=true and t.backlogItem.id in :items and t.projectId=p.id "
                        + "and p.tenantId=:tenant and p.projectId in :projects", Object[].class)
                .setParameter("items", items.keySet()).setParameter("tenant", tenant).setParameter("projects", projects).getResultList()) {
            Task task = (Task) row[0];
            SprintBacklog parent = items.get(task.getBacklogItem().getId());
            if (Objects.equals(ProjectReportQueryRepository.projectId(parent), row[1]) && activeSprint(parent)
                    && (task.getStatus() == TaskStatus.TODO || task.getStatus() == TaskStatus.IN_PROGRESS)
                    && task.getDeadline() != null && task.getDeadline().isBefore(now)) {
                var context = rows.get((Long) row[1]);
                result.add(new RiskRow("task:" + task.getId(), "TASK", context.id(), context.name(), context.teamName(),
                        task.getTitle(), task.getDeadline(), "OVERDUE"));
            }
        }
        return List.copyOf(result);
    }

    private Map<String,Long> zeros(String... states) {
        Map<String,Long> result = new LinkedHashMap<>();
        for (String state : states) result.put(state, 0L);
        return result;
    }
}
