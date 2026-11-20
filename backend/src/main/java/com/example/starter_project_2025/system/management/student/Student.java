package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "students")
@DiscriminatorValue("STUDENT")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("student")
@ExportEntity(fileName = "students", sheetName = "Students")
@ResourcePermission("STUDENT")
@ResourceMenu(
        title = "Students",
        group = "RBAC Management",
        icon = "graduation-cap",
        url = "/students",
        order = 2,
        permission = "STUDENT_READ"
)
public class Student extends User {

    @Column(name = "student_code", unique = true, nullable = false, length = 30)
    @ImportField(name = "Student Code", required = true)
    @ExportField(name = "Student Code")
    String studentCode;

    @Column(length = 1000)
    @ImportField(name = "Address")
    @ExportField(name = "Address")
    String address;

    @Builder.Default
    @Column(nullable = false, length = 20)
    String status = "ACTIVE";
}