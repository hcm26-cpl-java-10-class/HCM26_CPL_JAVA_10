package com.example.starter_project_2025.system.demo.coursepolicy;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.demo.course.Course;
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
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

/**
 * How a course is considered "completed". A course without a row here keeps the original behaviour:
 * 100% of active lessons and passing all required grading checks.
 */
@Entity
@Table(name = "course_completion_rules",
        uniqueConstraints = @UniqueConstraint(name = "uk_completion_rule_course", columnNames = "course_id"))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CourseCompletionRule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    Course course;

    /** Share of active lessons a learner must finish (1..100). */
    @Column(name = "min_lesson_percent", nullable = false)
    int minLessonPercent;

    /** true = learner must also pass the course's graded assessments. */
    @Column(name = "require_assessments_pass", nullable = false)
    boolean requireAssessmentsPass;
}
