package com.example.starter_project_2025.system.exam.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AnonymousSessionRequest {

    @NotBlank(message = "Access code is required")
    private String accessCode;

    private String fingerprint;
}
