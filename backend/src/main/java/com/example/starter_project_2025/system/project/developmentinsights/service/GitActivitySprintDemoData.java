package com.example.starter_project_2025.system.project.developmentinsights.service;

import com.example.starter_project_2025.system.project.developmentinsights.domain.GitCommit;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitActivityDemoSprint;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitPullRequest;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLink;
import com.example.starter_project_2025.system.project.developmentinsights.domain.TaskGitLinkSource;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitCommitRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitActivityDemoSprintRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitPullRequestRepository;
import com.example.starter_project_2025.system.project.developmentinsights.repository.TaskGitLinkRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Adds report fixtures beside existing work items, only for an explicitly marked mock repository. */
@Component
@RequiredArgsConstructor
public class GitActivitySprintDemoData {
    public static final String REPORT_SPRINT_NAME = "Git Activity Demo - Sprint Report";
    public static final String EMPTY_SPRINT_NAME = "Git Activity Demo - No Activity";
    private static final ZoneId BUSINESS_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final SprintRepository sprints;
    private final SprintBacklogRepository tasks;
    private final GitCommitRepository commits;
    private final GitPullRequestRepository pullRequests;
    private final TaskGitLinkRepository links;
    private final GitActivityDemoSprintRepository fixtures;

    void seed(Workspace workspace, GitRepository repository) {
        if (!repository.isMockData() || workspace.getProject() == null) return;
        Long projectId = workspace.getProject().getId();
        if (fixtures.existsById(projectId)) return;
        Long teamId = workspace.getTeam() == null ? null : workspace.getTeam().getId();
        String reportName = REPORT_SPRINT_NAME + " - Project " + projectId;
        String emptyName = EMPTY_SPRINT_NAME + " - Project " + projectId;
        // Adopt the earlier local fixture once; subsequent runs use persisted IDs, never editable names.
        Sprint reportSprint = sprints.findFirstByProjectIdAndNameOrderByIdAsc(projectId, reportName)
                .or(() -> sprints.findFirstByProjectIdAndNameOrderByIdAsc(projectId, REPORT_SPRINT_NAME)).orElse(null);
        Sprint emptySprint = sprints.findFirstByProjectIdAndNameOrderByIdAsc(projectId, emptyName)
                .or(() -> sprints.findFirstByProjectIdAndNameOrderByIdAsc(projectId, EMPTY_SPRINT_NAME)).orElse(null);

        List<GitCommit> commitRows = commits.findAllByRepository_IdOrderByCommittedAtAscIdAsc(repository.getId());
        List<GitPullRequest> prRows = pullRequests.findAllByRepository_IdOrderByCreatedAtAscIdAsc(repository.getId());
        List<Instant> eventTimes = new ArrayList<>();
        commitRows.forEach(commit -> eventTimes.add(commit.getCommittedAt()));
        prRows.forEach(pr -> {
            if (pr.getCreatedAt() != null) eventTimes.add(pr.getCreatedAt());
            if (pr.getMergedAt() != null) eventTimes.add(pr.getMergedAt());
        });
        if (eventTimes.isEmpty()) return;
        LocalDate start = eventTimes.stream().min(Instant::compareTo).orElseThrow().atZone(BUSINESS_ZONE).toLocalDate();
        LocalDate lastEvent = eventTimes.stream().max(Instant::compareTo).orElseThrow().atZone(BUSINESS_ZONE).toLocalDate();
        LocalDate today = LocalDate.now(BUSINESS_ZONE);
        LocalDate end = (lastEvent.isAfter(today) ? lastEvent : today).plusDays(7);

        if (reportSprint == null) {
            boolean activeExists = sprints.existsByProjectIdAndStatus(projectId, SprintStatus.ACTIVE)
                    || teamId != null && sprints.existsByTeamIdAndStatus(teamId, SprintStatus.ACTIVE);
            Sprint sprint = createSprint(projectId, teamId, reportName, start, end,
                    activeExists ? SprintStatus.PLANNED : SprintStatus.ACTIVE);
            reportSprint = sprint;
            SprintBacklog done = createTask(sprint, "Git demo: delivered task", SprintBacklogStatus.DONE);
            SprintBacklog inProgress = createTask(sprint, "Git demo: implementation in progress", SprintBacklogStatus.IN_PROGRESS);
            SprintBacklog review = createTask(sprint, "Git demo: waiting for review", SprintBacklogStatus.REVIEW);
            createTask(sprint, "Git demo: planned task without Git activity", SprintBacklogStatus.TODO);
            List<SprintBacklog> linkedTasks = List.of(done, inProgress, review);
            for (int i = 0; i < Math.min(linkedTasks.size(), commitRows.size()); i++) {
                TaskGitLink link = new TaskGitLink();
                link.setTask(linkedTasks.get(i));
                link.setCommit(commitRows.get(i));
                link.setSource(TaskGitLinkSource.AUTO);
                link.setLinkedAt(commitRows.get(i).getCommittedAt());
                links.save(link);
            }
            for (int i = 0; i < Math.min(2, prRows.size()); i++) {
                TaskGitLink link = new TaskGitLink();
                link.setTask(linkedTasks.get(i));
                link.setPullRequest(prRows.get(i));
                link.setSource(TaskGitLinkSource.AUTO);
                link.setLinkedAt(prRows.get(i).getCreatedAt());
                links.save(link);
            }
        }
        if (emptySprint == null) {
            emptySprint = createSprint(projectId, teamId, emptyName, end.plusDays(8), end.plusDays(14), SprintStatus.PLANNED);
        }
        fixtures.saveAndFlush(GitActivityDemoSprint.register(workspace.getProject(), repository, reportSprint, emptySprint));
    }

    private Sprint createSprint(Long projectId, Long teamId, String name, LocalDate start, LocalDate end, SprintStatus status) {
        Sprint sprint = new Sprint();
        sprint.setProjectId(projectId);
        sprint.setTeamId(teamId);
        sprint.setName(name);
        sprint.setSprintGoal("Mock fixture for the Git Activity Sprint report; existing work items are preserved.");
        sprint.setStartDate(start.atStartOfDay());
        sprint.setEndDate(end.atTime(23, 59));
        sprint.setStatus(status);
        return sprints.saveAndFlush(sprint);
    }

    private SprintBacklog createTask(Sprint sprint, String title, SprintBacklogStatus status) {
        SprintBacklog task = new SprintBacklog();
        task.setProjectId(sprint.getProjectId());
        task.setSprint(sprint);
        task.setTitle(title);
        task.setDescription("Mock fixture for Git Activity reports. This is an additional demo item.");
        task.setStatus(status);
        task.setStartDate(sprint.getStartDate());
        task.setEndDate(sprint.getEndDate());
        task.setEstimatedHours(4.0);
        return tasks.saveAndFlush(task);
    }
}
