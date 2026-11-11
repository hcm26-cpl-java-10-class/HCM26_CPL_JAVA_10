package com.example.starter_project_2025.system.exam.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(
        name = "exam_grade_scale",
        indexes = {
                @Index(name = "idx_exam_grade_scale_exam", columnList = "exam_id")
        }
)
@Getter
@Setter
@NoArgsConstructor
public class ExamGradeScale extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id")
    private Exam exam;

    /** Loại thang điểm: GRADE (chữ A, B, C...) hoặc PERCENTAGE (khoảng %) */
    @Column(nullable = false, length = 20)
    private String scaleType = "GRADE";

    @Column(nullable = false, length = 20)
    private String gradeLetter; // A, B, C, D, F hoặc 0-49%, 50-69%...

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal minScore; // Giá trị điểm min (hoặc % min)

    @Column(nullable = false, precision = 6, scale = 2)
    private BigDecimal maxScore; // Giá trị điểm max (hoặc % max)

    @Column(length = 50)
    private String label; // "Giỏi", "Khá" hoặc "Yếu (<50%)"

    @Column(length = 20)
    private String color; // "#10b981", "#3b82f6", ...

    @Column(nullable = false)
    private Integer displayOrder = 0;
}
