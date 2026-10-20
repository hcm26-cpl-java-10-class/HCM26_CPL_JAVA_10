package com.example.starter_project_2025.system.demo.department;

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
@Table(name = "departments")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("DEPARTMENT")
@ResourceMenu(
        title = "Departments",
        group = "Course Management",
        icon = "building-2",
        url = "/departments",
        order = 3,
        permission = "DEPARTMENT_READ"
)
public class Department extends BaseEntity {

    @Column(nullable = false, unique = true, length = 150)
    String name;

    @Column(nullable = false, unique = true, length = 50)
    String code;

    @Column(length = 500)
    String description;
}