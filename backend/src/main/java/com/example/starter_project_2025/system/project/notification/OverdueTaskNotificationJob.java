package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskRepository;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertAccess;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.UUID;

@Component
@Slf4j
public class OverdueTaskNotificationJob {
    private static final List<TaskStatus> OPEN_STATUSES = List.of(TaskStatus.TODO, TaskStatus.IN_PROGRESS);

    private final TaskRepository tasks;
    private final TaskAlertAccess access;
    private final NotificationService notifications;
    private final Clock clock;

    public OverdueTaskNotificationJob(TaskRepository tasks, TaskAlertAccess access,
                                      NotificationService notifications,
                                      @Qualifier("taskAlertClock") Clock clock) {
        this.tasks = tasks;
        this.access = access;
        this.notifications = notifications;
        this.clock = clock;
    }

    @Scheduled(fixedDelayString = "${app.notification.deadline-check-ms:60000}")
    @Transactional
    public void notifyAssigneesOfOverdueTasks() {
        var now = clock.instant();
        for (Task task : tasks.findAllByIsActiveTrueAndStatusInAndDeadlineBefore(OPEN_STATUSES, now)) {
            if (task.getAssigneeProjectMemberId() == null) continue;

            var assignee = access.directory().recipient(task.getProjectId(), task.getAssigneeProjectMemberId());
            if (assignee.isEmpty()) {
                log.debug("Skipping overdue task {} because its assignee is no longer active", task.getId());
                continue;
            }

            Long userId = assignee.get().user().getId();
            String eventKey = eventKey(task.getId(), task.getDeadline().toEpochMilli(), userId);
            String title = "Overdue task";
            String message = "Task \"" + task.getTitle() + "\" is overdue (deadline "
                    + task.getDeadline() + "). Please update its progress.";
            notifications.createOnce(userId, eventKey, title, message,
                    "/tasks/" + task.getId() + "/detail");
        }
    }

    private String eventKey(UUID taskId, long deadlineEpochMillis, Long userId) {
        return "task-overdue:" + taskId + ":" + deadlineEpochMillis + ":" + userId;
    }
}
