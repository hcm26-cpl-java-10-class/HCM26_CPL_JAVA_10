package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;

/** Diem (thang 10) cua mot sinh vien trong mot cot diem. */
@Entity
@Table(name = "gradebook_score",
        uniqueConstraints = @UniqueConstraint(name = "uk_gradebook_score", columnNames = {"column_id", "student_id"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookScore extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "column_id", nullable = false)
    private GradebookColumn column;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(precision = 6, scale = 2)
    private BigDecimal score;

    /** EXAM = lay tu bai thi, MANUAL = giang vien nhap tay. */
    @Column(nullable = false, length = 10)
    private String source;
}
