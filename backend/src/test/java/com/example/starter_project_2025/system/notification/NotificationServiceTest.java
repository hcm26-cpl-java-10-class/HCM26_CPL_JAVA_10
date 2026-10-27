package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationServiceTest {

    private final NotificationRepository notificationRepository = mock(NotificationRepository.class);
    private final UserRepository userRepository = mock(UserRepository.class);
    private final NotificationService service = new NotificationService(notificationRepository, userRepository);

    @Test
    void doesNotCreateDuplicateEvent() {
        when(notificationRepository.existsByEventKey("course-completed:40")).thenReturn(true);

        service.createOnce(7L, "course-completed:40", "Completed", "Done", "/courses/10");

        verify(notificationRepository, never()).save(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void marksOnlyAnOwnedNotificationAsRead() {
        Notification notification = Notification.builder().id(5L).user(User.builder().id(7L).build()).build();
        when(notificationRepository.findByIdAndUser_Id(5L, 7L)).thenReturn(Optional.of(notification));

        service.markRead(7L, 5L);

        assertNotNull(notification.getReadAt());
    }
}

