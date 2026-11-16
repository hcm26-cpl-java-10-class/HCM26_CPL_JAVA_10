package com.example.starter_project_2025.system.calendar;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Request payload for validating a candidate class schedule before saving.
 */
public record CalendarValidateRequest(
        Long classId,
        LocalDate learningStartDate,
        List<CandidateSession> sessions
) {
    public record CandidateSession(
            String candidateKey,
            String title,
            Long topicId,
            Long trainerId,
            String location,
            LocalDateTime startTime,
            LocalDateTime endTime
    ) {
    }
}

