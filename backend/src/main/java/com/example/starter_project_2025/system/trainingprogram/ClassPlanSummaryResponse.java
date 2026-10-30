package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public record ClassPlanSummaryResponse(
        Long classId,
        String classCode,
        String className,
        String classStatus,
        Integer enrolledCount,
        Integer plannedSize,
        boolean hasProgram,
        Long programId,
        String programCode,
        String programName,
        String programVersion,
        int totalSubjects,
        int totalDurationHours,
        int coursesAssignedCount,
        int subjectsWithTrainerCount,
        int subjectsWithScheduleCount,
        int totalScheduledSessions,
        List<MissingSubjectItem> missingCourses,
        List<MissingSubjectItem> missingAssignments,
        List<MissingSubjectItem> missingSchedules,
        boolean programChangeBlocked,
        List<String> programChangeBlockReasons
) {
    public record MissingSubjectItem(
            Long programSubjectId,
            Long subjectId,
            String subjectCode,
            String subjectName,
            String subjectVersion,
            Integer orderIndex,
            Integer durationHours
    ) {}
}

