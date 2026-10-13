package com.example.starter_project_2025.system.profile;

import java.util.Set;

public record ProfileDTO(
        Long id,
        String email,
        String firstName,
        String lastName,
        Set<String> roles
) {
}