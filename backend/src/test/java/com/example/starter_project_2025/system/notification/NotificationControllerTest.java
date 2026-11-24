package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class NotificationControllerTest {
    private final NotificationService service = mock(NotificationService.class);
    private final NotificationController controller = new NotificationController(service);

    @Test
    void rejectsMissingAndInactiveAccounts() {
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.getMine(null, 0, 10)).getStatusCode().value());
        UserPrincipal inactive = new UserPrincipal(User.builder().id(7L).isActive(false).build(), List.of());
        assertEquals(401, assertThrows(ResponseStatusException.class,
                () -> controller.getMine(inactive, 0, 10)).getStatusCode().value());
    }

    @Test
    void forwardsOnlyTheAuthenticatedAccountToHistoryAndReadActions() {
        UserPrincipal principal = new UserPrincipal(User.builder().id(7L).isActive(true).build(), List.of());
        NotificationListDTO expected = new NotificationListDTO(List.of(), 0, 2, 4, 35);
        when(service.getForUser(7L, 2, 10)).thenReturn(expected);

        assertEquals(expected, controller.getMine(principal, 2, 10));
        controller.markRead(principal, 9L);
        controller.markAllRead(principal);

        verify(service).getForUser(7L, 2, 10);
        verify(service).markRead(7L, 9L);
        verify(service).markAllRead(7L);
    }
}
