package com.example.starter_project_2025.system.schedule;

import java.time.LocalDateTime;

public record ScheduleIssue(String code, String field, String message, int candidateIndex,
        Integer relatedCandidateIndex, Long relatedSessionId, String relatedTitle,
        LocalDateTime relatedStart, LocalDateTime relatedEnd) {}
