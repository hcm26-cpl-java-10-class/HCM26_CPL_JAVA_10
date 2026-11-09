package com.example.starter_project_2025.system.demo.enrollment;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class CourseEnrollmentDTO {
    private Long id;
    private Long courseId;
    private String courseName;
    private String courseDescription;
    private String thumbnailUrl;
    private String instructor;
    private LocalDateTime enrolledAt;
}
