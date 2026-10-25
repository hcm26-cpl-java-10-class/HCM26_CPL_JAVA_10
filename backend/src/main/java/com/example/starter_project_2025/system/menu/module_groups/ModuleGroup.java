package com.example.starter_project_2025.system.menu.module_groups;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.menu.module.Module;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Fetch;
import org.hibernate.annotations.FetchMode;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "module_groups")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("module_group")
@ExportEntity(fileName = "module_groups", sheetName = "Module Groups")
@ResourcePermission("MENU")
@ResourceMenu(
        title = "Module Groups",
        group = "System Management",
        icon = "menu_groups",
        url = "/menu-groups",
        order = 1,
    permission = "USER_READ"
)
public class ModuleGroup extends BaseEntity {

    @Column(unique = true, nullable = false, length = 100)
    String name;

    @Column(length = 500)
    String description;

    @Builder.Default
    @Column(nullable = false)
    Integer displayOrder = 0;

    @OneToMany(mappedBy = "moduleGroup", cascade = CascadeType.ALL, orphanRemoval = true)
    @Fetch(FetchMode.SUBSELECT)
    List<Module> modules = new ArrayList<>();
}
