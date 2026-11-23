package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationCenterServiceTest {

    private final NotificationRepository notifications = mock(NotificationRepository.class);
    private final NotificationPreferenceRepository preferences = mock(NotificationPreferenceRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private NotificationService service;

    @BeforeEach
    void setUp() {
        service = new NotificationService(notifications, users);
        ReflectionTestUtils.setField(service, "preferenceRepository", preferences);
        when(users.getReferenceById(7L)).thenReturn(User.builder().id(7L).build());
    }

    @Test
    void newNotificationGetsCategoryFromEventKey() {
        service.createOnce(7L, "exam.review.assigned.5", "Review", "Please review", "/exams/5");

        ArgumentCaptor<Notification> saved = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(saved.capture());
        assertEquals(NotificationCategory.EXAM, saved.getValue().getCategory());
    }

    @Test
    void skipsNotificationWhenUserTurnedCategoryOff() {
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.EXAM))
                .thenReturn(Optional.of(NotificationPreference.builder().inAppEnabled(false).build()));

        service.createOnce(7L, "exam.review.assigned.5", "Review", "Please review", "/exams/5");

        verify(notifications, never()).save(any());
    }

    @Test
    void otherCategoriesStillDeliveredWhenOneIsOff() {
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.EXAM))
                .thenReturn(Optional.of(NotificationPreference.builder().inAppEnabled(false).build()));

        service.createOnce(7L, "course-completed:1", "Done", "Well done", "/courses/1");

        verify(notifications).save(any(Notification.class));
    }

    @Test
    void preferencesDefaultToEnabledForEveryCategory() {
        when(preferences.findByUser_Id(7L)).thenReturn(List.of(
                NotificationPreference.builder().category(NotificationCategory.PROJECT).inAppEnabled(false).build()));

        List<NotificationPreferenceDTO> result = service.getPreferences(7L);

        assertEquals(NotificationCategory.values().length, result.size());
        assertFalse(result.stream().filter(p -> p.category() == NotificationCategory.PROJECT).findFirst().orElseThrow().inAppEnabled());
        assertTrue(result.stream().filter(p -> p.category() == NotificationCategory.EXAM).findFirst().orElseThrow().inAppEnabled());
    }

    @Test
    void updatePreferencesCreatesOrUpdatesRows() {
        NotificationPreference existing = NotificationPreference.builder()
                .category(NotificationCategory.COURSE).inAppEnabled(true).build();
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.COURSE)).thenReturn(Optional.of(existing));
        when(preferences.findByUser_IdAndCategory(7L, NotificationCategory.EXAM)).thenReturn(Optional.empty());
        when(preferences.findByUser_Id(7L)).thenReturn(List.of());

        service.updatePreferences(7L, List.of(
                new NotificationPreferenceDTO(NotificationCategory.COURSE, false),
                new NotificationPreferenceDTO(NotificationCategory.EXAM, false),
                new NotificationPreferenceDTO(null, false)));

        assertFalse(existing.isInAppEnabled());
        verify(preferences, org.mockito.Mockito.times(2)).save(any(NotificationPreference.class));
    }

    @Test
    void pageUsesCategoryAndUnreadFiltersAndClampsSize() {
        when(notifications.findByUser_IdAndCategoryAndReadAtIsNull(eq(7L), eq(NotificationCategory.EXAM), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of()));
        when(notifications.countUnreadByCategory(7L)).thenReturn(List.<Object[]>of(
                new Object[]{NotificationCategory.EXAM, 3L}, new Object[]{null, 2L}));

        NotificationPageDTO page = service.getPage(7L, NotificationCategory.EXAM, true, -4, 1000);

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(notifications).findByUser_IdAndCategoryAndReadAtIsNull(eq(7L), eq(NotificationCategory.EXAM), pageable.capture());
        assertEquals(0, pageable.getValue().getPageNumber());
        assertEquals(100, pageable.getValue().getPageSize());
        assertEquals(5L, page.unreadCount());
        assertEquals(3L, page.unreadByCategory().get(NotificationCategory.EXAM));
        assertEquals(2L, page.unreadByCategory().get(NotificationCategory.SYSTEM));
        assertEquals(0L, page.unreadByCategory().get(NotificationCategory.PROJECT));
    }

    @Test
    void deleteOnlyRemovesOwnNotification() {
        when(notifications.deleteOwned(9L, 7L)).thenReturn(0);

        assertThrows(ResourceNotFoundException.class, () -> service.delete(7L, 9L));

        when(notifications.deleteOwned(10L, 7L)).thenReturn(1);
        service.delete(7L, 10L);
        verify(notifications).deleteOwned(10L, 7L);
    }

    @Test
    void backfillFillsMissingCategories() {
        Notification old = Notification.builder().eventKey("lesson-created:3").build();
        when(notifications.findByCategoryIsNull()).thenReturn(List.of(old));

        assertEquals(1, service.backfillCategories());
        assertEquals(NotificationCategory.COURSE, old.getCategory());
    }
}
