package com.example.starter_project_2025.system.demo.lessonreport;

import java.time.LocalDateTime;

public record LessonReportInboxDTO(
        Long id,
        LessonReportReason reason,
        String detail,
        LessonReportStatus status,
        LocalDateTime createdAt,
        Long reporterId,
        String reporterName,
        Long lessonId,
        String lessonTitle,
        Long sectionId,
        String sectionTitle,
        Long courseId,
        String courseName
) {
}
