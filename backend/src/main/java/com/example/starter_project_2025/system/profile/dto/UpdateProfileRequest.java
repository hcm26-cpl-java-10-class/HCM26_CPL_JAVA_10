package com.example.starter_project_2025.system.profile.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
    @NotBlank(message = "Full name is required")
    @Size(min = 2, max = 100, message = "Full name must be between 2 and 100 characters")
    String fullName,

    @NotBlank(message = "Phone number is required")
    @Pattern(regexp = "^(0|\\+84)?[0-9\\s\\-().]{9,15}$", message = "Phone number format is invalid (must be 9 to 15 digits)")
    String phoneNumber
) {}
