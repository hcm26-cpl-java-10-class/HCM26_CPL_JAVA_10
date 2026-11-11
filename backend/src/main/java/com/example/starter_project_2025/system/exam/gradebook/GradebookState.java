package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

/** Lan giang vien bam "Save scores" xac nhan bang diem cua mot course. */
@Entity
@Table(name = "gradebook_state",
        uniqueConstraints = @UniqueConstraint(name = "uk_gradebook_state_course", columnNames = "course_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class GradebookState extends BaseEntity {

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    private Course course;

    @Column(name = "saved_at", nullable = false)
    private LocalDateTime savedAt;

    @Column(name = "saved_by_user")
    private Long savedByUser;
}
