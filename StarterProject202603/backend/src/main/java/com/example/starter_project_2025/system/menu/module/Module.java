package com.example.starter_project_2025.system.menu.module;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.menu.module_groups.ModuleGroup;
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
@Table(name = "modules")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("module")
@ExportEntity(fileName = "modules", sheetName = "Modules")
@ResourcePermission("MENU")
@ResourceMenu(
        title = "Modules",
        group = "System Management",
        icon = "menus",
        url = "/menus",
        order = 2,
    permission = "USER_READ"
)
public class Module extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "module_group_id", nullable = false)
    ModuleGroup moduleGroup;

    @Column(nullable = false, length = 100)
    String title;

    @Column(length = 500)
    String url;

    @Column(length = 50)
    String icon;

    @Column(length = 500)
    String description;

    @Builder.Default
    @Column(nullable = false)
    Integer displayOrder = 0;

    @Column(length = 100)
    String requiredPermission;
}
