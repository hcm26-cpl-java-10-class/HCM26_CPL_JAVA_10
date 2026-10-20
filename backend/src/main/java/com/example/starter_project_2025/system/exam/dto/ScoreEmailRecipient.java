package com.example.starter_project_2025.system.exam.dto;

public record ScoreEmailRecipient(
        Long studentId,
        String email,
        String scoreSummary
) {
}
