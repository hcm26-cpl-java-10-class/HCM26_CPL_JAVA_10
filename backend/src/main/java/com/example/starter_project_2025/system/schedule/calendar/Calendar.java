package com.example.starter_project_2025.system.schedule.calendar;

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
@Table(name = "calendars")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("calendar")
@ExportEntity(fileName = "calendars", sheetName = "Calendars")
@ResourcePermission("CALENDAR")
@ResourceMenu(
        title = "Calendars",
        group = "Calendar Management",
        icon = "calendars",
        url = "/calendars",
        order = 1,
        permission = "CALENDAR_READ"
)
public class Calendar extends BaseEntity {

    @Column(unique = true, nullable = false, length = 100)
    @ImportField(name = "ClassId", required = true)
    @ExportField(name = "ClassId")
    Long classId;

    @Column
    @ImportField(name = "Last Version")
    @ExportField(name = "Last Version")
    Integer lastIssuedVersionNumber = 0;

    @Column(nullable = false, length = 150)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(length = 500)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;
}
