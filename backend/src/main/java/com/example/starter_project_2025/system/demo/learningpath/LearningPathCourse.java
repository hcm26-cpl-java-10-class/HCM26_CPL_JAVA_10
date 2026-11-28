package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.OnDelete;
import org.hibernate.annotations.OnDeleteAction;

@Entity
@Table(name = "learning_path_courses",
        uniqueConstraints = @UniqueConstraint(name = "uk_path_course", columnNames = {"path_id", "course_id"}))
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class LearningPathCourse extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "path_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    LearningPath path;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    @OnDelete(action = OnDeleteAction.CASCADE)
    Course course;

    /** 1-based order inside the path. */
    @Column(nullable = false)
    int position;
}
