package com.example.starter_project_2025.system.rbac.department;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
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
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "departments")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("department")
@ExportEntity(fileName = "departments", sheetName = "Departments")
@ResourcePermission("DEPARTMENT")
@ResourceMenu(
        title = "Departments",
        group = "RBAC Management",
        icon = "building",
        url = "/departments",
        order = 4,
        permission = "DEPARTMENT_READ"
)
public class Department extends BaseEntity {

    @Column(unique = true, nullable = false, length = 50)
    @ImportField(name = "Code", required = true)
    @ExportField(name = "Code")
    String code;

    @Column(nullable = false, length = 150)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(length = 500)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    /** Phòng ban cha; null = phòng ban gốc. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_department_id")
    Department parentDepartment;
}
