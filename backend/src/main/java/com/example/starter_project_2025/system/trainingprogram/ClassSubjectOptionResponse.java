package com.example.starter_project_2025.system.trainingprogram;

public record ClassSubjectOptionResponse(
        Long programSubjectId,
        Long subjectId,
        String subjectCode,
        String subjectName,
        String subjectVersion,
        Integer orderIndex,
        Integer durationHours,
        Long courseId,
        String courseCode,
        String courseName
) {}

