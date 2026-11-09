package com.example.starter_project_2025.system.demo.course;

import java.math.BigDecimal;
import java.util.List;

public record CourseMyScoresDTO(
        Long courseId,
        String courseCode,
        String courseName,
        String className,
        BigDecimal overallScore,
        String resultStatus,
        List<CourseGradeItemDTO> gradeItems
) {
}