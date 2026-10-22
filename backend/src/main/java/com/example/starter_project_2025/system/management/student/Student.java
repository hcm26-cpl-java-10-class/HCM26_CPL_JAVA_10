package com.example.starter_project_2025.system.management.student;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportUpsert;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDate;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "students")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("student")
@ExportEntity(fileName = "students", sheetName = "Students")
@ImportUpsert(keyField = "studentCode", displayName = "student")
@ResourcePermission("STUDENT")
@ResourceMenu(title = "Students", group = "Student Management", icon = "graduation-cap", url = "/students", order = 2, permission = "STUDENT_READ")
public class Student extends BaseEntity {

    @Column(unique = true, nullable = false, length = 30)
    @ImportField(name = "Student Code", required = true)
    @ExportField(name = "Student Code")
    String studentCode;

    @Column(nullable = false, length = 100)
    @ImportField(name = "First Name", required = true)
    @ExportField(name = "First Name")
    String firstName;

    @Column(nullable = false, length = 100)
    @ImportField(name = "Last Name", required = true)
    @ExportField(name = "Last Name")
    String lastName;

    @Column(unique = true, length = 255)
    @ImportField(name = "Email")
    @ExportField(name = "Email")
    String email;

    @Column(length = 30)
    @ImportField(name = "Phone")
    @ExportField(name = "Phone")
    String phone;

    @ImportField(name = "Date of Birth")
    @ExportField(name = "Date of Birth")
    LocalDate dateOfBirth;

    @Column(length = 20)
    @ImportField(name = "Gender")
    @ExportField(name = "Gender")
    String gender;

    @Column(nullable = false, length = 60)
    @ImportField(name = "Class Name", required = true)
    @ExportField(name = "Class Name")
    String className;

    @Column(length = 500)
    @ImportField(name = "Address")
    @ExportField(name = "Address")
    String address;

    @lombok.Builder.Default
    @Column(nullable = false, length = 20)
    @ImportField(name = "Status")
    @ExportField(name = "Status")
    String status = "ACTIVE";

    public String getFullName() {
        return (firstName == null ? "" : firstName)
                + (lastName == null || lastName.isBlank() ? "" : " " + lastName);
    }
}
