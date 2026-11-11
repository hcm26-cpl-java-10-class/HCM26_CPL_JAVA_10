package com.example.starter_project_2025.system.trainingprogram;

public record ClassSetupOverviewResponse(
        Long classId,
        String code,
        String name,
        String status,
        String startDate,
        String endDate,
        String site,
        String location,
        String formatType,
        Integer plannedSize,
        Integer enrolledCount,
        Long programId,
        String programCode,
        String programName,
        String programVersion,
        int totalSubjects,
        int coursesAssignedCount,
        int subjectsWithTrainerCount,
        int subjectsWithScheduleCount,
        int scheduledSessionCount,
        int missingCourseCount,
        int missingTrainerCount,
        int missingScheduleCount,
        boolean setupComplete
) {}

