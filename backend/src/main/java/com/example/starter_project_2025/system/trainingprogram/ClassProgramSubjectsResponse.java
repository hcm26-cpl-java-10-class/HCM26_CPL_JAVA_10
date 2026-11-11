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
    public ClassProgramSubjectsResponse(Long classId, String classCode, String className,
            ProgramSummary program, List<ProgramSubjectItem> subjects) {
        this(classId, classCode, className, null, program, false, List.of(), false, subjects);
    }
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
            java.math.BigDecimal totalDurationHours
    ) {
        public ProgramSummary(Long id, String code, String name, String version, ProgramStatus status) {
            this(id, code, name, version, null, status, java.math.BigDecimal.ZERO);
        }
        public static ProgramSummary from(TrainingProgram program) {
            java.math.BigDecimal hours = program.getSubjects().stream()
                    .map(item -> item.getSubject().getDurationHours()).filter(java.util.Objects::nonNull)
                    .reduce(java.math.BigDecimal.ZERO, java.math.BigDecimal::add);
            return new ProgramSummary(program.getId(), program.getCode(), program.getName(), program.getVersion(),
                    program.getRegion(), program.getStatus(), hours);
        }
    }

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
            java.math.BigDecimal durationHours,
            Integer orderIndex,
            CourseItem course,
            boolean courseChangeLocked,
            List<CourseItem> availableCourses,
            List<TeachingAssignmentResponse> assignments,
            int scheduledSessionCount,
            int completedSessionCount
    ) {
        public ProgramSubjectItem(Long programSubjectId, Long subjectId, String subjectCode, String subjectName,
                java.math.BigDecimal durationHours, Integer orderIndex, List<TeachingAssignmentResponse> assignments) {
            this(programSubjectId, subjectId, subjectCode, subjectName, null, null, durationHours,
                    orderIndex, null, false, List.of(), assignments, 0, 0);
        }
    }
}
