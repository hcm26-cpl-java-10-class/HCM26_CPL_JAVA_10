package com.example.starter_project_2025.system.exam.invitation.job;

import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.invitation.domain.Invitation;
import com.example.starter_project_2025.system.exam.invitation.domain.InvitationRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ExamReminderJobTest {

    private static final LocalDateTime NOW = LocalDateTime.of(2026, 11, 23, 10, 0);

    @Test
    void picksWindowFromTimeRemaining() {
        assertEquals(Optional.of(ExamReminderJob.Window.ONE_DAY), ExamReminderJob.dueWindow(NOW, NOW.plusHours(23)));
        assertEquals(Optional.of(ExamReminderJob.Window.ONE_DAY), ExamReminderJob.dueWindow(NOW, NOW.plusHours(24)));
        assertEquals(Optional.of(ExamReminderJob.Window.ONE_HOUR), ExamReminderJob.dueWindow(NOW, NOW.plusMinutes(59)));
        assertEquals(Optional.of(ExamReminderJob.Window.ONE_HOUR), ExamReminderJob.dueWindow(NOW, NOW.plusHours(1)));
    }

    @Test
    void noReminderTooEarlyOrAlreadyOpen() {
        assertTrue(ExamReminderJob.dueWindow(NOW, NOW.plusHours(25)).isEmpty());
        assertTrue(ExamReminderJob.dueWindow(NOW, NOW).isEmpty());
        assertTrue(ExamReminderJob.dueWindow(NOW, NOW.minusMinutes(5)).isEmpty());
        assertTrue(ExamReminderJob.dueWindow(NOW, null).isEmpty());
    }

    @Test
    void createsOneNotificationPerDueInvitationWithTargetLink() {
        InvitationRepository repo = mock(InvitationRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        Exam exam = new Exam();
        exam.setId(5L);
        exam.setTitle("Java Core Quiz");
        Invitation due = Invitation.builder().id(11L).exam(exam).user(User.builder().id(7L).build())
                .availableFrom(NOW.plusMinutes(30)).build();
        Invitation guest = Invitation.builder().id(12L).exam(exam).availableFrom(NOW.plusMinutes(30)).build();
        when(repo.findUpcomingForReminders(any(), any(), any())).thenReturn(List.of(due, guest));

        int handled = new ExamReminderJob(repo, notifications).sendReminders(NOW);

        assertEquals(1, handled);
        verify(notifications).createOnce(eq(7L), contains("exam.reminder.1h.11."), eq("Exam starts within 1 hour"),
                contains("Java Core Quiz"), eq("/student/exams/5/prepare"));
        verify(notifications, never()).createOnce(eq(0L), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void doesNothingWhenNobodyIsInvited() {
        InvitationRepository repo = mock(InvitationRepository.class);
        NotificationService notifications = mock(NotificationService.class);
        when(repo.findUpcomingForReminders(any(), any(), any())).thenReturn(List.of());

        assertEquals(0, new ExamReminderJob(repo, notifications).sendReminders(NOW));
        verify(notifications, never()).createOnce(anyLong(), anyString(), anyString(), anyString(), anyString());
    }
}
