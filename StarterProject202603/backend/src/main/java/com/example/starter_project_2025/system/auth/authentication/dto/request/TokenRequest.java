package com.example.starter_project_2025.system.auth.authentication.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Builder;

@Builder
public record TokenRequest(

        @NotBlank(message = "Token cannot be blank")
        String token
) {
}
