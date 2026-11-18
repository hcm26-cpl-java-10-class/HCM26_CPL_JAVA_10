package com.example.starter_project_2025.system.project.notification;

import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskRepository;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertAccess;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertData;
import com.example.starter_project_2025.system.project.task.alert.TaskAlertProjectBridge;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OverdueTaskNotificationJobTest {
    @Mock private TaskRepository tasks;
    @Mock private TaskAlertAccess access;
    @Mock private TaskAlertProjectBridge directory;
    @Mock private NotificationService notifications;

    @Test
    void createsInAppNotificationForTheCurrentActiveAssignee() {
        Instant now = Instant.parse("2026-11-06T00:00:00Z");
        UUID taskId = UUID.randomUUID();
        UUID projectId = UUID.randomUUID();
        UUID memberId = UUID.randomUUID();
        Instant deadline = now.minusSeconds(60);
        Task task = Task.builder().id(taskId).projectId(projectId).assigneeProjectMemberId(memberId)
                .title("Finish milestone report").deadline(deadline).status(TaskStatus.IN_PROGRESS)
                .isActive(true).build();
        User assignee = mock(User.class);
        when(assignee.getId()).thenReturn(42L);
        when(tasks.findAllByIsActiveTrueAndStatusInAndDeadlineBefore(anyList(), eq(now))).thenReturn(List.of(task));
        when(access.directory()).thenReturn(directory);
        when(directory.recipient(projectId, memberId)).thenReturn(Optional.of(new TaskAlertProjectBridge.Member(
                memberId, assignee, TaskAlertData.MemberSource.PROJECT_MEMBER, 7L)));

        new OverdueTaskNotificationJob(tasks, access, notifications,
                Clock.fixed(now, ZoneOffset.UTC)).notifyAssigneesOfOverdueTasks();

        verify(notifications).createOnce(42L, "task-overdue:" + taskId + ":" + deadline.toEpochMilli() + ":42",
                "Overdue task",
                "Task \"Finish milestone report\" is overdue (deadline " + deadline + "). Please update its progress.",
                "/tasks/" + taskId + "/detail");
    }

    @Test
    void doesNotNotifyWhenTheTaskHasNoAssignee() {
        Instant now = Instant.parse("2026-11-06T00:00:00Z");
        Task task = Task.builder().id(UUID.randomUUID()).projectId(UUID.randomUUID())
                .title("Unassigned task").deadline(now.minusSeconds(1)).status(TaskStatus.TODO)
                .isActive(true).build();
        when(tasks.findAllByIsActiveTrueAndStatusInAndDeadlineBefore(anyList(), eq(now))).thenReturn(List.of(task));

        new OverdueTaskNotificationJob(tasks, access, notifications,
                Clock.fixed(now, ZoneOffset.UTC)).notifyAssigneesOfOverdueTasks();

        verifyNoInteractions(notifications, access);
    }
}
