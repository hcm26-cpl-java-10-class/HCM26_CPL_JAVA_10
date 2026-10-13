package com.example.starter_project_2025.system.demo.subject;

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
import lombok.*;
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
        group = "Course Management",
        icon = "book-open",
        url = "/subjects",
        order = 2,
        permission = "SUBJECT_READ"
)
public class Subject extends BaseEntity {

    @Column(unique = true, nullable = false, length = 50)
    @ImportField(name = "Code", required = true)
    @ExportField(name = "Code")
    String code;

    @Column(nullable = false, length = 150)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(nullable = false)
    @ImportField(name = "Credits", required = true)
    @ExportField(name = "Credits")
    Integer credits;

    @Column(length = 500)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;
}
