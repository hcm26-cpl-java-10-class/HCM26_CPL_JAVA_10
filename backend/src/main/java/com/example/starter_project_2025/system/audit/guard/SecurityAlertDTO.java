package com.example.starter_project_2025.system.audit.guard;

import java.time.LocalDateTime;

public record SecurityAlertDTO(
        Long id,
        String type,
        String status,
        Long userId,
        String userEmail,
        String ipAddress,
        int requestCount,
        int windowSeconds,
        String lastPath,
        int hits,
        LocalDateTime createdAt,
        LocalDateTime lastSeenAt,
        LocalDateTime resolvedAt,
        String resolvedBy,
        /** Set while the user of this alert is currently blocked. */
        LocalDateTime blockedUntil
) {

    public static SecurityAlertDTO from(SecurityAlert a, LocalDateTime blockedUntil) {
        return new SecurityAlertDTO(
                a.getId(), a.getType(), a.getStatus(), a.getUserId(), a.getUserEmail(),
                a.getIpAddress(), a.getRequestCount(), a.getWindowSeconds(), a.getLastPath(),
                a.getHits(), a.getCreatedAt(), a.getLastSeenAt(), a.getResolvedAt(),
                a.getResolvedBy(), blockedUntil);
    }
}
