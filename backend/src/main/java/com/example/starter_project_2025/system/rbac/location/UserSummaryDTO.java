package com.example.starter_project_2025.system.rbac.location;

import lombok.Builder;

@Builder
public record UserSummaryDTO(
        Long id,
        String email,
        String fullName,
        String phone,
        String roleName
) {}