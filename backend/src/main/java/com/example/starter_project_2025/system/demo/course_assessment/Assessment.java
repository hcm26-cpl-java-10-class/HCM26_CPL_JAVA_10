package com.example.starter_project_2025.system.demo.course_assessment;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "assessments")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("assessment")
@ExportEntity(fileName = "assessments", sheetName = "Assessments")
@ResourcePermission("ASSESSMENT")
@ResourceMenu(
        title = "Assessments",
        group = "Course Management",
        icon = "graduation-cap",
        url = "/assessments",
        order = 2,
        permission = "ASSESSMENT_READ"
)
public class Assessment extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "course_id", nullable = false)
    @ImportField(name = "Course", required = true, lookupEntity = Course.class, lookupField = "name")
    @ExportField(name = "Course")
    Course course;

    @Column(nullable = false, length = 255)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @Builder.Default
    @ImportField(name = "Type", required = true)
    @ExportField(name = "Type")
    AssessmentType type = AssessmentType.QUIZ;

    @Column
    @ImportField(name = "Time Limit (minutes)")
    @ExportField(name = "Time Limit (minutes)")
    Integer timeLimit;

    @Column
    @ImportField(name = "Max Attempts")
    @ExportField(name = "Max Attempts")
    Integer maxAttempt;

    @Column
    @ImportField(name = "Due At")
    @ExportField(name = "Due At")
    LocalDateTime dueAt;
}
