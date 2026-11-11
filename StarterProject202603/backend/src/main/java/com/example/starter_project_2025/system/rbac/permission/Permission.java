package com.example.starter_project_2025.system.rbac.permission;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.role.Role;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.util.HashSet;
import java.util.Set;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "permissions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("permission")
@ExportEntity(fileName = "permissions", sheetName = "Permissions")
@ResourcePermission("PERMISSION")
@ResourceMenu(
        title = "Permissions",
        group = "RBAC Management",
        icon = "permissions",
        url = "/permissions",
        order = 3,
        permission = "PERMISSION_READ"
)
public class Permission extends BaseEntity {

    @Column(unique = true, nullable = false, length = 100)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Column(nullable = false, length = 50)
    @ImportField(name = "Resource", required = true)
    @ExportField(name = "Resource")
    String resource;

    @Column(nullable = false, length = 50)
    @ImportField(name = "Action", required = true)
    @ExportField(name = "Action")
    String action;

    @Builder.Default
    @ManyToMany(mappedBy = "permissions", fetch = FetchType.LAZY)
    Set<Role> roles = new HashSet<>();
}
