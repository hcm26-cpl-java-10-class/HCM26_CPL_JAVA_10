package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/**
 * Ban chup bang diem tai thoi diem giang vien bam "Save scores".
 * Day la nguon du lieu cho trang My Scores cua sinh vien (sua bang diem sau do chua luu thi sinh vien chua thay).
 */
@Entity
@Table(name = "gradebook_published_item",
        indexes = @Index(name = "idx_gb_pub_course_student", columnList = "course_id, student_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookPublishedItem extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false)
    private int position;

    @Column(name = "column_type", length = 20)
    private String columnType;

    @Column(name = "column_name", nullable = false, length = 100)
    private String columnName;

    @Column(name = "exam_id")
    private Long examId;

    @Column(name = "exam_title", length = 255)
    private String examTitle;

    @Column(name = "weight_percent", nullable = false, precision = 5, scale = 2)
    private BigDecimal weightPercent;

    @Column(precision = 6, scale = 2)
    private BigDecimal score;
}
