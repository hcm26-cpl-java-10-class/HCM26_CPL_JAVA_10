package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ReminderStatus;
import com.example.starter_project_2025.system.exam.domain.ReminderType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AnonymousAccessResponse {
    private boolean valid;
    private String accessCode;
    private String examTitle;
    private String studentName;
    private int accessAttemptsRemaining;
    private String message;
}
