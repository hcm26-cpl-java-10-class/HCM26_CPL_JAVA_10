package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberEligibility;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@Slf4j
public class OverdueBacklogNotificationJob {
    private static final List<SprintBacklogStatus> OPEN_STATUSES =
            List.of(SprintBacklogStatus.TODO, SprintBacklogStatus.IN_PROGRESS, SprintBacklogStatus.REVIEW);

    private final SprintBacklogRepository backlogItems;
    private final ProjectMemberRepository projectMembers;
    private final WorkspaceRepository workspaces;
    private final NotificationService notifications;
    private final Clock clock;
    private final ZoneId deadlineZone;

    public OverdueBacklogNotificationJob(SprintBacklogRepository backlogItems,
                                         ProjectMemberRepository projectMembers,
                                         WorkspaceRepository workspaces,
                                         NotificationService notifications,
                                         @Qualifier("taskAlertClock") Clock clock,
                                         @Qualifier("backlogDeadlineZone") ZoneId deadlineZone) {
        this.backlogItems = backlogItems;
        this.projectMembers = projectMembers;
        this.workspaces = workspaces;
        this.notifications = notifications;
        this.clock = clock;
        this.deadlineZone = deadlineZone;
    }

    @Scheduled(fixedDelayString = "${app.notification.deadline-check-ms:60000}")
    @Transactional
    public void notifyAssigneesOfOverdueBacklogItems() {
        LocalDateTime now = LocalDateTime.ofInstant(clock.instant(), deadlineZone);
        List<SprintBacklog> overdueItems =
                backlogItems.findAllByIsActiveTrueAndStatusInAndEndDateBeforeAndAssigneeProjectMemberIdIsNotNull(
                        OPEN_STATUSES, now);
        if (overdueItems.isEmpty()) return;

        Collection<Long> memberIds = overdueItems.stream()
                .map(SprintBacklog::getAssigneeProjectMemberId)
                .distinct()
                .toList();
        Map<Long, ProjectMember> membersById = projectMembers.findAllByIdIn(memberIds).stream()
                .collect(Collectors.toMap(ProjectMember::getId, Function.identity(), (first, ignored) -> first));

        for (SprintBacklog item : overdueItems) {
            ProjectMember assignee = membersById.get(item.getAssigneeProjectMemberId());
            if (!isActiveAssignee(assignee, item)) {
                log.debug("Skipping overdue backlog item {} because its assignee is no longer active or eligible",
                        item.getId());
                continue;
            }

            Long userId = assignee.getClassMember().getUser().getId();
            Long teamId = assignee.getTeam().getId();
            var workspace = workspaces.findCurrentByTeamId(teamId)
                    .or(() -> workspaces.findAllByTeam_IdAndIsActiveTrueOrderByCreatedAtDescIdDesc(teamId)
                            .stream().findFirst());
            if (workspace.isEmpty()) {
                log.warn("Skipping overdue backlog notification for item {} because team {} has no workspace",
                        item.getId(), teamId);
                continue;
            }

            String eventKey = eventKey(item, userId);
            String title = "Overdue backlog item";
            String message = "Backlog item \"" + item.getTitle() + "\" is overdue (due "
                    + item.getEndDate() + "). Please update its progress.";
            String targetUrl = "/management/workspaces/" + workspace.get().getId()
                    + "?tab=backlog&itemId=" + item.getId();
            if (item.getProjectId() != null) targetUrl += "&project=" + item.getProjectId();
            notifications.createOnce(userId, eventKey, title, message, targetUrl);
        }
    }

    private boolean isActiveAssignee(ProjectMember member, SprintBacklog item) {
        if (!ProjectMemberEligibility.canAssign(member)) return false;
        var team = member.getTeam();
        var user = member.getClassMember().getUser();
        var tenant = user.getTenant();
        var trainingClass = team.getTrainingClass();
        if (team.getStatus() != ProjectTeamStatus.ACTIVE || !Boolean.TRUE.equals(team.getIsActive())
                || !Boolean.TRUE.equals(trainingClass.getIsActive())
                || tenant == null || !Boolean.TRUE.equals(tenant.getActive())
                || !Boolean.TRUE.equals(tenant.getIsActive())) return false;

        if (item.getSprint() != null && item.getSprint().getTeamId() != null) {
            return Objects.equals(team.getId(), item.getSprint().getTeamId());
        }
        return item.getProjectId() != null && Objects.equals(team.getProjectId(), item.getProjectId());
    }

    private String eventKey(SprintBacklog item, Long userId) {
        return "backlog-overdue:" + item.getId() + ":" + item.getEndDate() + ":" + userId;
    }
}
