package com.example.starter_project_2025.system.exam.dto;

import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamType;

import java.math.BigDecimal;

/** Thong tin gon cua mot bai thi thuoc course (khong chua cau hoi / dap an). */
public record CourseExamDTO(
        Long id,
        String title,
        ExamCategory category,
        ExamType examType,
        int durationMinutes,
        Integer maxAttempts,
        BigDecimal maxScore,
        BigDecimal passScore,
        Boolean isActive,
        Long courseId,
        Long sectionId,
        String sectionTitle,
        Long lessonId,
        String lessonTitle,
        /** Chi giao vien/admin thay: so cau hoi. Sinh vien nhan null. */
        Integer questionCount,
        /** Chi giao vien/admin thay: ten nguoi tao. Sinh vien nhan null. */
        String createdByName,
        /** Student view: true while blocked by LessonProgress. Staff always get false. */
        boolean locked,
        /** Why it is locked (null when unlocked). */
        String lockReason
) {
}