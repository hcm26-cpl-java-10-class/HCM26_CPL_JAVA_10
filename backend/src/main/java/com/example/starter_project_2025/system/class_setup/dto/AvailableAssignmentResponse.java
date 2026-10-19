package com.example.starter_project_2025.system.class_setup.dto;

import com.example.starter_project_2025.system.class_setup.AssignmentRole;

import java.time.LocalDate;

public record AvailableAssignmentResponse(
        Long assignmentId,
        Long classId,
        String classCode,
        Long programSubjectId,
        Long subjectId,
        String subjectCode,
        String subjectName,
        Integer orderIndex,
        Long trainerId,
        String trainerName,
        String trainerEmail,
        AssignmentRole role,
        LocalDate effectiveFrom,
        LocalDate effectiveTo
) {}
