package com.example.starter_project_2025.system.demo.category;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
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
@Table(name = "categories")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ResourcePermission("CATEGORY")
@ImportEntity("category")
@ResourceMenu(
        title = "Categories",
        group = "Course Management",
        icon = "folder-tree",
        url = "/categories",
        order = 2,
        permission = "CATEGORY_READ"
)
public class Category extends BaseEntity {

    @Column(nullable = false, length = 150)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(unique = true, nullable = false, length = 50)
    @ImportField(name = "Code", required = true)
    @ExportField(name = "Code")
    String code;

    @Column(length = 500)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    Category parent;
}