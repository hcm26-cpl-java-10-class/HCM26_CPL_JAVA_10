package com.example.starter_project_2025.system.exam.supervisor.dto;

import java.time.Instant;

public record SupervisorAttemptDTO(
        Long attemptId,
        Long examId,
        String examTitle,
        Long studentId,
        String studentName,
        String studentEmail,
        Instant startedAt,
        Instant deadlineAt
) {}