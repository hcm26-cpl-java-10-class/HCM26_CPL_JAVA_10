package com.example.starter_project_2025.system.subject;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SubjectCloneRequest(
        @NotBlank(message = "New version is required")
        @Size(max = 20, message = "Version must not exceed 20 characters") String version) {
}
