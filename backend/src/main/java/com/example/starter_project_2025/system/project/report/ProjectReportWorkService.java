package com.example.starter_project_2025.system.project.report;

import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.Task;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.project.report.ProjectReportDtos.*;

/** Main work items from the current workspace and legacy Kanban; UUID subtasks are not added. */
@Service
@RequiredArgsConstructor
public class ProjectReportWorkService {
    private final EntityManager em;
    private final ProjectReportSettings settings;

    public WorkReport load(ProjectReportService.Snapshot snapshot) {
        Map<Long,SubProject> rows = snapshot.matching().stream().collect(Collectors.toMap(SubProject::id, row -> row));
        if (rows.isEmpty()) {
            if (snapshot.filter().workSprintId() != null) throw new AccessDeniedException("Sprint nằm ngoài kết quả báo cáo");
            return new WorkReport(BacklogCounts.empty(), List.of(), null);
        }
        Set<Long> teams = rows.values().stream().map(SubProject::teamId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long,Sprint> sprints = new HashMap<>();
        Map<Long,BacklogCounts> counts = new HashMap<>();
        Map<Long,Map<Long,SubProject>> contexts = new HashMap<>();
        BacklogCounts all = BacklogCounts.empty();
        for (var row : rows.values()) for (var item : snapshot.source().backlogs().getOrDefault(row.id(), List.of())) {
            var count = ProjectReportQueryRepository.counts(List.of(item));
            all = all.plus(count);
            if (item.getSprint() != null) {
                Long id = item.getSprint().getId();
                sprints.put(id, item.getSprint());
                counts.merge(id, count, BacklogCounts::plus);
                contexts.computeIfAbsent(id, ignored -> new HashMap<>()).put(row.id(), row);
            }
        }
        for (Task task : em.createQuery("select t from Task t where t.isActive=true and (t.projectId in :projects "
                        + "or (t.projectId is null and t.teamId in :teams))", Task.class)
                .setParameter("projects", rows.keySet()).setParameter("teams", teams.isEmpty() ? Set.of(-1L) : teams).getResultList()) {
            SubProject row = context(snapshot, rows, task.getProjectId(), task.getTeamId());
            if (row == null) continue;
            var count = count(task.getStatus() == null ? null : task.getStatus().name());
            // Only attach a task to a Sprint that belongs to this authorized Project/team.
            if (task.getSprintId() != null) {
                Sprint sprint = em.find(Sprint.class, task.getSprintId());
                if (sprint == null || !Boolean.TRUE.equals(sprint.getIsActive()) || !owns(sprint, row)) continue;
                sprints.put(sprint.getId(), sprint);
                counts.merge(sprint.getId(), count, BacklogCounts::plus);
                contexts.computeIfAbsent(sprint.getId(), ignored -> new HashMap<>()).put(row.id(), row);
            }
            all = all.plus(count);
        }
        for (Sprint sprint : em.createQuery("select s from Sprint s where s.isActive=true and (s.projectId in :projects "
                        + "or (s.projectId is null and s.teamId in :teams))", Sprint.class)
                .setParameter("projects", rows.keySet()).setParameter("teams", teams.isEmpty() ? Set.of(-1L) : teams).getResultList()) {
            var row = context(snapshot, rows, sprint.getProjectId(), sprint.getTeamId());
            if (row != null && owns(sprint, row)) {
                sprints.putIfAbsent(sprint.getId(), sprint);
                contexts.computeIfAbsent(sprint.getId(), ignored -> new HashMap<>()).putIfAbsent(row.id(), row);
            }
        }
        var result = sprints.values().stream().map(sprint -> {
            var scope = contexts.get(sprint.getId()).values().stream().sorted(Comparator.comparing(SubProject::id)).toList();
            var row = scope.getFirst();
            return new SprintRow(sprint.getId(), sprint.getName(), sprint.getStatus().name(), scope.size() == 1 ? row.id() : null,
                    scope.size() == 1 ? row.code() : null, scope.stream().map(SubProject::name).distinct().collect(Collectors.joining(", ")),
                    sprint.getTeamId() == null ? row.teamId() : sprint.getTeamId(), row.teamName(), instant(sprint.getStartDate()),
                    instant(sprint.getEndDate()), counts.getOrDefault(sprint.getId(), BacklogCounts.empty()));
        }).sorted(Comparator.comparing(SprintRow::startAt, Comparator.nullsLast(Comparator.naturalOrder())).thenComparing(SprintRow::id)).toList();
        Long selected = snapshot.filter().workSprintId();
        if (selected != null) {
            var chosen = result.stream().filter(row -> selected.equals(row.id())).findFirst()
                    .orElseThrow(() -> new AccessDeniedException("Sprint nằm ngoài kết quả báo cáo"));
            all = chosen.backlog();
        }
        return new WorkReport(all, result, selected);
    }

    static SubProject context(ProjectReportService.Snapshot snapshot, Map<Long,SubProject> rows, Long project, Long team) {
        if (project != null) {
            var row = rows.get(project);
            return row != null && (team == null || Objects.equals(team, row.teamId())) ? row : null;
        }
        if (team == null) return null;
        return snapshot.source().teams().stream().filter(owner -> team.equals(owner.getId()))
                .map(owner -> rows.get(owner.getProjectId())).filter(Objects::nonNull).findFirst().orElse(null);
    }

    private boolean owns(Sprint sprint, SubProject row) {
        return (sprint.getProjectId() == null || Objects.equals(sprint.getProjectId(), row.id()))
                && (sprint.getTeamId() == null || Objects.equals(sprint.getTeamId(), row.teamId()));
    }
    static BacklogCounts count(String status) {
        return new BacklogCounts("TODO".equals(status) ? 1 : 0, "IN_PROGRESS".equals(status) ? 1 : 0,
                "REVIEW".equals(status) ? 1 : 0, "DONE".equals(status) ? 1 : 0, 0);
    }
    private Instant instant(LocalDateTime value) { return value == null ? null : value.atZone(settings.zone()).toInstant(); }
}
