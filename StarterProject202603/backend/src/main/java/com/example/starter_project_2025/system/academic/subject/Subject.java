package com.example.starter_project_2025.system.academic.subject;

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
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
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
@Table(name = "subjects")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("subject")
@ExportEntity(fileName = "subjects", sheetName = "Subjects")
@ResourcePermission("SUBJECT")
@ResourceMenu(
        title = "Subjects",
        group = "Academic Management",
        icon = "books",
        url = "/subjects",
        order = 1,
        permission = "SUBJECT_READ"
)
public class Subject extends BaseEntity {

    @Column(unique = true, nullable = false, length = 30)
    @ImportField(name = "Subject Code", required = true)
    @ExportField(name = "Subject Code")
    String subjectCode;

    @Column(nullable = false, length = 200)
    @ImportField(name = "Subject Name", required = true)
    @ExportField(name = "Subject Name")
    String subjectName;

    @Column(length = 30)
    @ImportField(name = "Version")
    @ExportField(name = "Version")
    String version;

    @Column(length = 100)
    @ImportField(name = "Technical Group")
    @ExportField(name = "Technical Group")
    String technicalGroup;

    @Column
    @ImportField(name = "Duration Hours", required = true)
    @ExportField(name = "Duration Hours")
    Integer durationHours;

    @Builder.Default
    @Column(nullable = false, length = 20)
    @ImportField(name = "Status")
    @ExportField(name = "Status")
    String status = "ACTIVE";

    @Column(length = 1000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;
}