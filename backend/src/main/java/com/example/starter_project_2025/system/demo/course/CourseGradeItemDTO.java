package com.example.starter_project_2025.system.demo.course;

import java.math.BigDecimal;

public record CourseGradeItemDTO(
        String gradeCategory,
        Long examId,
        String gradeItem,
        BigDecimal gradeWeight,
        BigDecimal value
) {
}