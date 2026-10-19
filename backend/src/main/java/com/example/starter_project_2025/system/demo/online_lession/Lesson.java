package com.example.starter_project_2025.system.demo.online_lession;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "lessons",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_lesson_course_title",
                columnNames = {"course_id", "title"}
        )
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("LESSON")
@ResourceMenu(
        title = "Lessons",
        group = "Online Learning",
        icon = "video",
        url = "/lessons",
        order = 1,
        permission = "LESSON_READ"
)
public class Lesson extends BaseEntity {

    @Column(nullable = false, length = 200)
    String title;

    @Column(length = 1000)
    String description;

    @Column(length = 500)
    String videoUrl;

    /** Duration in minutes. */
    @Column
    Integer durationMinutes;

    /** Position of the lesson inside its course (1, 2, 3...). */
    @Column(nullable = false)
    Integer orderIndex;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    Course course;
}
