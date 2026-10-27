package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnonymousAttemptRequest {

    @NotBlank(message = "Session token is required")
    private String sessionToken;

    private String password;
}