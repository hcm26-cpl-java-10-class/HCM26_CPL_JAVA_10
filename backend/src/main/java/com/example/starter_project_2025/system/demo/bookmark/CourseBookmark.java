package com.example.starter_project_2025.system.demo.bookmark;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

/**
 * Course bookmarked by a learner for later review or enrollment.
 */
@Entity
@Table(
        name = "course_bookmarks",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_course_bookmark_user_course",
                        columnNames = {"user_id", "course_id"}
                )
        }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class CourseBookmark extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    Long userId;

    @Column(name = "course_id", nullable = false)
    Long courseId;
}
