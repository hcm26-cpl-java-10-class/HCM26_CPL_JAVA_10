package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public NotificationListDTO getMine(@AuthenticationPrincipal UserPrincipal principal) {
        return notificationService.getForUser(userId(principal));
    }

    @PatchMapping("/{notificationId}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long notificationId
    ) {
        notificationService.markRead(userId(principal), notificationId);
    }

    @PatchMapping("/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead(@AuthenticationPrincipal UserPrincipal principal) {
        notificationService.markAllRead(userId(principal));
    }

    private Long userId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}

