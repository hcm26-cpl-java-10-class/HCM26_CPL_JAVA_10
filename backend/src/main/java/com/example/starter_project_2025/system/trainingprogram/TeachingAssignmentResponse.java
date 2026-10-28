package com.example.starter_project_2025.system.trainingprogram;

import java.time.LocalDate;

public record TeachingAssignmentResponse(
        Long id,
        Long classId,
        String classCode,
        Long programSubjectId,
        Long subjectId,
        String subjectCode,
        String subjectName,
        Long trainerId,
        String trainerName,
        AssignmentRole role,
        LocalDate effectiveFrom,
        LocalDate effectiveTo,
        String className,
        String subjectVersion,
        String trainerEmail,
        Long programId,
        String programCode,
        String programName,
        String programVersion,
        Long revision
) {}
