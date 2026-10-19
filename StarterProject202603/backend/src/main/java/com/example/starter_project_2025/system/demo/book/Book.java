package com.example.starter_project_2025.system.demo.book;

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
@Table(name = "books")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("book")
@ExportEntity(fileName = "books", sheetName = "Books")
@ResourcePermission("BOOK")
@ResourceMenu(
        title = "Books",
        group = "Book Management",
        icon = "books",
        url = "/books",
        order = 1,
        permission = "BOOK_READ"
)
public class Book extends BaseEntity {

    @Column(unique = true, nullable = false, length = 100)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;
}
