package com.example.starter_project_2025.system.auth.authentication.dto.response;

import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.Instant;
import java.time.LocalDateTime;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UserSessionDTO {
    String sessionId;
    String ipAddress;
    String userAgent;
    boolean rememberMe;
    boolean current;
    LocalDateTime createdAt;
    Instant lastUsedAt;
    Instant expiresAt;
}
