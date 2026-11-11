package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.exam.domain.Exam;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/** Mot cot diem cua bang diem (gradebook) mot course. Giang vien tu them / xoa / doi ti trong. */
@Entity
@Table(name = "gradebook_column")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookColumn extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(nullable = false, length = 100)
    private String name;

    /** Ti trong (%) cua cot trong diem tong ket. */
    @Column(name = "weight_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal weightPercent;

    /** Loai cot: ASSIGNMENT, QUIZ, MIDTERM, FINAL (null = cot cu chua co loai). */
    @Column(length = 20)
    private String type;

    @Column(nullable = false)
    private int position;

    /** Bai thi gan gan nhat vao cot nay (null neu cot chi nhap tay). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "source_exam_id")
    private Exam sourceExam;
}
