package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    private final NotificationRepository notificationRepository = mock(NotificationRepository.class);
    private final NotificationWriter notificationWriter = mock(NotificationWriter.class);
    private final NotificationService service = new NotificationService(notificationRepository, notificationWriter);

    @Test
    void existingEventIsScopedToRecipient() {
        when(notificationRepository.existsByUser_IdAndEventKey(7L, "course-completed:40")).thenReturn(true);

        service.createOnce(7L, "course-completed:40", "Completed", "Done", "/courses/10");

        verify(notificationWriter, never()).insert(any(), any(), any(), any(), any());
        verify(notificationWriter).updateTargetUrl(7L, "course-completed:40", "/courses/10");
        verify(notificationRepository, never()).existsByUser_IdAndEventKey(8L, "course-completed:40");
    }

    @Test
    void concurrentDuplicateIsRecoveredOutsideTheProducerTransaction() {
        when(notificationRepository.existsByUser_IdAndEventKey(7L, "event")).thenReturn(false, true);
        doThrow(new DataIntegrityViolationException("duplicate"))
                .when(notificationWriter).insert(7L, "event", "Title", "Message", "/target");

        service.createOnce(7L, "event", "Title", "Message", "/target");

        verify(notificationWriter).updateTargetUrl(7L, "event", "/target");
    }

    @Test
    void nonDuplicateInsertFailureIsNotHidden() {
        when(notificationRepository.existsByUser_IdAndEventKey(7L, "event")).thenReturn(false);
        doThrow(new DataIntegrityViolationException("foreign key"))
                .when(notificationWriter).insert(7L, "event", "Title", "Message", "/target");

        assertThrows(DataIntegrityViolationException.class,
                () -> service.createOnce(7L, "event", "Title", "Message", "/target"));
    }

    @Test
    void returnsOwnedPageWithGlobalUnreadCount() {
        Notification item = Notification.builder().id(5L).title("Owned").message("Message")
                .user(User.builder().id(7L).build()).build();
        when(notificationRepository.findByUser_IdOrderByCreatedAtDesc(eq(7L), any()))
                .thenReturn(new PageImpl<>(List.of(item)));
        when(notificationRepository.countByUser_IdAndReadAtIsNull(7L)).thenReturn(12L);

        NotificationListDTO result = service.getForUser(7L, 0, 10);

        assertEquals(1, result.items().size());
        assertEquals(12, result.unreadCount());
        assertEquals(1, result.totalItems());
        verify(notificationRepository, never()).findByUser_IdOrderByCreatedAtDesc(eq(8L), any());
    }

    @Test
    void marksOnlyAnOwnedNotificationAsRead() {
        Notification notification = Notification.builder().id(5L).user(User.builder().id(7L).build()).build();
        when(notificationRepository.findByIdAndUser_Id(5L, 7L)).thenReturn(Optional.of(notification));

        service.markRead(7L, 5L);

        assertNotNull(notification.getReadAt());
        assertThrows(ResourceNotFoundException.class, () -> service.markRead(8L, 5L));
    }

    @Test
    void markAllReadIsAccountScoped() {
        service.markAllRead(7L);

        verify(notificationRepository).markAllRead(eq(7L), any());
        verify(notificationRepository, never()).markAllRead(eq(8L), any());
    }
}
