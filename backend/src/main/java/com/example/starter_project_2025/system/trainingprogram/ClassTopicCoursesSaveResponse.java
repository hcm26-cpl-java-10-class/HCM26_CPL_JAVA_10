package com.example.starter_project_2025.system.trainingprogram;

public record ClassTopicCoursesSaveResponse(
        Long classId,
        String classCode,
        int assignedCount,
        int updatedCount,
        int removedCount,
        int unchangedCount,
        String message,
        ClassProgramSubjectsResponse plan
) {}

