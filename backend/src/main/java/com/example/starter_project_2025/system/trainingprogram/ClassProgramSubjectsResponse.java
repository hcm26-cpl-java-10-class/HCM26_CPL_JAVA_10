package com.example.starter_project_2025.system.trainingprogram;

import java.util.List;

public record ClassProgramSubjectsResponse(
        Long classId,
        String classCode,
        String className,
        ClassContext classContext,
        ProgramSummary program,
        boolean programChangeBlocked,
        List<String> programChangeBlockReasons,
        boolean courseChangeLockedByEnrollment,
        List<ProgramSubjectItem> subjects
) {
    public record ClassContext(
            String status,
            String startDate,
            String endDate,
            String site,
            String location,
            String formatType,
            Integer plannedSize,
            Integer enrolledCount
    ) {}

    public record ProgramSummary(
            Long id,
            String code,
            String name,
            String version,
            String region,
            ProgramStatus status,
            int totalDurationHours
    ) {}

    public record CourseItem(
            Long courseId,
            String code,
            String name,
            String instructor,
            String description,
            boolean active
    ) {}

    public record ProgramSubjectItem(
            Long programSubjectId,
            Long subjectId,
            String subjectCode,
            String subjectName,
            String subjectVersion,
            String technicalGroup,
            Integer durationHours,
            Integer orderIndex,
            CourseItem course,
            boolean courseChangeLocked,
            List<CourseItem> availableCourses,
            List<TeachingAssignmentResponse> assignments,
            int scheduledSessionCount,
            int completedSessionCount
    ) {}
}
