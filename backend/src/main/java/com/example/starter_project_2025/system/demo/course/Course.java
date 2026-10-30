package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "courses")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("COURSE")
@ResourceMenu(
        title = "Courses",
        group = "Course Management",
        icon = "graduation-cap",
        url = "/courses",
        order = 1,
        permission = "COURSE_READ"
)
public class Course extends BaseEntity {

    @Column(unique = true, length = 50)
    String code;

    @Column(name = "subject_id")
    Long subjectId;

    @Column(unique = true, nullable = false, length = 150)
    String name;

    @Column(length = 500)
    String description;

    @Column(length = 255)
    String thumbnailUrl;

    @Column(length = 100)
    String instructor;
}
