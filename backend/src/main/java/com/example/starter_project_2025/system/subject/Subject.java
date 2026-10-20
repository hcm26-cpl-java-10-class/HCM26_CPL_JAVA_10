package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
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

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
    name = "subjects",
    uniqueConstraints = {
        // Acceptance criteria: Code and version combination must be unique
        @UniqueConstraint(name = "uk_subject_code_version", columnNames = {"code", "version"})
    }
)
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("subject")
@ExportEntity(fileName = "subjects", sheetName = "Subjects")
@ResourcePermission("SUBJECT")
@ResourceMenu(
    title = "Subjects",
    group = "Subject Management",
    icon = "book-open",
    url = "/subjects",
    order = 1,
    permission = "SUBJECT_READ"
)
public class Subject extends BaseEntity {

    @lombok.Builder.Default
    @jakarta.persistence.Enumerated(jakarta.persistence.EnumType.STRING)
    @Column(length = 20)
    SubjectStatus status = SubjectStatus.ACTIVE;

    @Column(nullable = false, length = 50)
    @ImportField(name = "Code", required = true)
    @ExportField(name = "Code")
    String code;

    @Column(nullable = false, length = 255)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(nullable = false, length = 20)
    @ImportField(name = "Version", required = true)
    @ExportField(name = "Version")
    String version;

    @Column(length = 1000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Column(name = "technical_group", length = 100)
    @ImportField(name = "Technical Group")
    @ExportField(name = "Technical Group")
    String technicalGroup;

    @Column(name = "duration_hours", nullable = false)
    @ImportField(name = "Duration (Hours)", required = true)
    @ExportField(name = "Duration (Hours)")
    Integer durationHours;
}

