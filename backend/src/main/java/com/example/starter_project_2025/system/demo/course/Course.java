package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.demo.category.Category;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.FetchType;
import com.example.starter_project_2025.system.rbac.user.User;
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
@ImportEntity("course")
@ResourceMenu(
        title = "Courses",
        group = "Course Management",
        icon = "graduation-cap",
        url = "/courses",
        order = 1,
        permission = "COURSE_READ"
)
public class Course extends BaseEntity {

    @Column(unique = true, nullable = false, length = 150)
    @ImportField(name = "Name", required = true)       // <-- thêm
    String name;

    @Column(length = 500)
    @ImportField(name = "Description", required = true)       // <-- thêm
    String description;

    @Column(length = 255)
    String thumbnailUrl;

    @Column(length = 100)
    String instructor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instructor_id")
    User instructorUser;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    Category category;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    CourseStatus status = CourseStatus.DRAFT;

    @Builder.Default
    @Column(nullable = false)
    Boolean isFree = true;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    CourseLevel level;
}
