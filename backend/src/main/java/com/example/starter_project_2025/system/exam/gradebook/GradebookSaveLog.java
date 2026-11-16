package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Lich su cac lan giang vien bam "Save scores". */
@Entity
@Table(name = "gradebook_save_log", indexes = @Index(name = "idx_gb_log_course", columnList = "course_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookSaveLog extends BaseEntity {

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "saved_by")
    private Long savedBy;

    @Column(name = "saved_by_name", length = 255)
    private String savedByName;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    @Column(name = "column_count")
    private int columnCount;

    @Column(name = "student_count")
    private int studentCount;

    @Column(name = "total_weight", precision = 7, scale = 2)
    private BigDecimal totalWeight;
}
