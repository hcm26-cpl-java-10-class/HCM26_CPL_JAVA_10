package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Table(
        name = "lesson_progress",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_lesson_progress_enrollment_lesson",
                columnNames = {"enrollment_id", "lesson_id"}
        )
)
@ResourcePermission("LESSON_PROGRESS")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LessonProgress extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "enrollment_id", nullable = false)
    CourseEnrollment enrollment;

    // Keep this as an ID so M6 can compile independently while M4 owns Lesson.
    @Column(name = "lesson_id", nullable = false)
    Long lessonId;

    @Column(name = "is_completed", nullable = false)
    boolean completed;

    @Column(name = "completed_at")
    LocalDateTime completedAt;

    @Column(name = "last_accessed_at", nullable = false)
    LocalDateTime lastAccessedAt;
}
