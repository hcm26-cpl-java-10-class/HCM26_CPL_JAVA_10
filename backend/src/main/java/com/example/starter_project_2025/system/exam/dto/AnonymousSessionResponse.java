package com.example.starter_project_2025.system.exam.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AnonymousSessionResponse {
    private boolean valid;
    private String sessionToken;
    private String examTitle;
    private int durationMinutes;
    private String message;
}
