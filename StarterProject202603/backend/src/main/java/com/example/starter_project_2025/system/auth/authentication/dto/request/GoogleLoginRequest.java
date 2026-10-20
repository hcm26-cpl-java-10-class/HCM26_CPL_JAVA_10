package com.example.starter_project_2025.system.auth.authentication.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

@Builder
public record GoogleLoginRequest(

        @NotBlank(message = "ID token is required")
        String idToken
) {
}
