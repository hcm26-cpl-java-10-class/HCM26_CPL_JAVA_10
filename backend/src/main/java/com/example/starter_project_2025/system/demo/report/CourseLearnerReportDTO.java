package com.example.starter_project_2025.system.demo.report;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CourseLearnerReportDTO {
    private Long enrollmentId;
    private String studentName;
    private String studentEmail;
    private int progressPercentage;
    private boolean completed;
    private LocalDateTime enrolledAt;
}
