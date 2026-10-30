package com.example.starter_project_2025.system.demo.lessonreport;

public final class LessonReportEvents {

    private LessonReportEvents() {
    }

    public record ReportCreated(Long instructorId, Long reportId, String message) {
    }
}
