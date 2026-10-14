package com.example.starter_project_2025.system.auth.authentication.dto.response;

import lombok.Builder;

import java.time.LocalDateTime;
import java.util.List;

@Builder
public record ProfileResponse(
        String email,
        String firstName,
        String lastName,
        List<String> roles,
        LocalDateTime createdAt
) {}
