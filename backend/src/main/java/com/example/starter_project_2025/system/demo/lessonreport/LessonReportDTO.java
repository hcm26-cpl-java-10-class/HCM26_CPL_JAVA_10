package com.example.starter_project_2025.system.demo.lessonreport;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record LessonReportDTO(
        Long id,
        Long lessonId,
        Long reporterId,
        String reporterName,
        LessonReportReason reason,
        String detail,
        LessonReportStatus status,
        LocalDateTime createdAt
) {

    public record CreateRequest(
            @NotNull(message = "Reason is required")
            LessonReportReason reason,

            @Size(max = LessonReportService.MAX_DETAIL_LENGTH,
                    message = "Detail must not exceed 1000 characters")
            String detail
    ) {
    }
}
