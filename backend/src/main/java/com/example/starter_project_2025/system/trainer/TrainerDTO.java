package com.example.starter_project_2025.system.trainer;

import java.time.LocalDate;
import java.util.List;

public record TrainerDTO(
        Long id,
        String trainerCode,
        String fullName,
        String email,
        String specialization,
        TrainerStatus status,
        List<Topic> teachingTopics,
        String source,
        List<TeachingHistoryItem> teachingHistory
) {
    public TrainerDTO(
            Long id,
            String trainerCode,
            String fullName,
            String email,
            String specialization,
            TrainerStatus status,
            List<Topic> teachingTopics,
            String source
    ) {
        this(id, trainerCode, fullName, email, specialization, status, teachingTopics, source, List.of());
    }

    public record Topic(Long id, String code, String name, String version, boolean active) {}

    public record TeachingHistoryItem(
            String classCode,
            String className,
            String subjectCode,
            String subjectName,
            String subjectVersion,
            String role,
            LocalDate effectiveFrom,
            LocalDate effectiveTo
    ) {}
}
