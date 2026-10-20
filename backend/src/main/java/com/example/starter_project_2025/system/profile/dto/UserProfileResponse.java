package com.example.starter_project_2025.system.profile.dto;

import lombok.Builder;
import java.util.List;
import java.util.Set;

@Builder
public record UserProfileResponse(
    Long id,
    String fullName,
    String firstName,
    String lastName,
    String email,
    String employeeCode,
    String phoneNumber,
    String role,
    Set<String> roles,
    String department,
    String status,
    String lastLogin,
    String device,
    List<String> skills
) {}
