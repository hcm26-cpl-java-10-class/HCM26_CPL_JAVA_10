package com.example.starter_project_2025.system.notification;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.validation.annotation.Validated;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@Validated
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping
    public NotificationListDTO getMine(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "10") @Min(1) @Max(50) int size
    ) {
        return notificationService.getForUser(userId(principal), page, size);
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

    /** Notification center: filter by category and unread, paged. */
    @GetMapping("/page")
    public NotificationPageDTO getPage(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean unreadOnly,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        if (category != null && !category.isBlank() && NotificationCategory.parse(category) == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown category: " + category);
        }
        return notificationService.getPage(userId(principal), NotificationCategory.parse(category), unreadOnly, page, size);
    }

    @DeleteMapping("/{notificationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long notificationId) {
        notificationService.delete(userId(principal), notificationId);
    }

    /** Removes every notification the user has already read. */
    @DeleteMapping("/read")
    public java.util.Map<String, Integer> deleteRead(@AuthenticationPrincipal UserPrincipal principal) {
        return java.util.Map.of("deleted", notificationService.deleteRead(userId(principal)));
    }

    @GetMapping("/preferences")
    public List<NotificationPreferenceDTO> getPreferences(@AuthenticationPrincipal UserPrincipal principal) {
        return notificationService.getPreferences(userId(principal));
    }

    @PutMapping("/preferences")
    public List<NotificationPreferenceDTO> updatePreferences(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestBody List<NotificationPreferenceDTO> body
    ) {
        return notificationService.updatePreferences(userId(principal), body);
    }

    private Long userId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null
                || !Boolean.TRUE.equals(principal.getUser().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}

