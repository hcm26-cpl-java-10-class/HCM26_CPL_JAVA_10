package com.example.starter_project_2025.system.rbac.role;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.rbac.permission.Permission;
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
@Table(name = "roles")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("role")
@ExportEntity(fileName = "roles", sheetName = "Roles")
@ResourcePermission("ROLE")
@ResourceMenu(
        title = "Roles",
        group = "RBAC Management",
        icon = "roles",
        url = "/roles",
        order = 2,
        permission = "ROLE_READ"
)
public class Role extends BaseEntity {

    @Column(unique = true, nullable = false, length = 100)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @Builder.Default
    @ManyToMany(fetch = FetchType.LAZY)
    @ExportField(name = "Permissions", relation = true, path = "name")
    @ImportField(name = "Permissions", lookupEntity = Permission.class, lookupField = "name", separator = ",")
    @JoinTable( name = "role_permissions",
                joinColumns = @JoinColumn(name = "role_id"),
                inverseJoinColumns = @JoinColumn(name = "permission_id"))
    Set<Permission> permissions = new HashSet<>();
}
