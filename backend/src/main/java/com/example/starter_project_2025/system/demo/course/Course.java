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

@com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity(fileName="courses",sheetName="Courses")
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
    @jakarta.persistence.ManyToMany
    @jakarta.persistence.JoinTable(name="course_category", joinColumns=@jakarta.persistence.JoinColumn(name="course_id"), inverseJoinColumns=@jakarta.persistence.JoinColumn(name="category_id"))
    @Builder.Default
    java.util.Set<com.example.starter_project_2025.system.demo.category.Category> categories = new java.util.HashSet<>();

    @Column(unique = true, length = 50)
    String code;

    @Column(name = "subject_id")
    Long subjectId;

    @Column(unique = true, nullable = false, length = 150)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Name")
    String name;

    @Column(length = 500)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Description")
    String description;

    @Column(length = 255)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Thumbnail URL")
    String thumbnailUrl;

    @Column(length = 100)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Instructor")
    String instructor;

    @Column(length = 255)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Category Codes")
    String category;

    @Column(length = 50)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Level")
    String courseLevel;

    @Column(length = 50)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Status")
    String publicationStatus;

    @Column(length = 255)
    @com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField(name="Instructor Email")
    String instructorEmail;
    public String getCategoryName() {
        if(categories != null && !categories.isEmpty()) return categories.stream().map(com.example.starter_project_2025.system.demo.category.Category::getName).filter(java.util.Objects::nonNull).sorted().collect(java.util.stream.Collectors.joining(", "));
        return category;
    }
}
