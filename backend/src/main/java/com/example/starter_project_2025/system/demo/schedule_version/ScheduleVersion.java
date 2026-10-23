package com.example.starter_project_2025.system.demo.schedule_version;

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

import java.time.LocalDateTime;

@Entity(name = "LegacyScheduleVersion")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "legacy_schedule_versions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("schedule_version")
@ExportEntity(fileName = "schedule_versions", sheetName = "Schedule Versions")
@ResourcePermission("SCHEDULE_VERSION")
@ResourceMenu(
        title = "Schedule Versions",
        group = "Schedule Management",
        icon = "calendar",
        url = "/schedule-versions",
        order = 3,
        permission = "SCHEDULE_VERSION_READ"
)
public class ScheduleVersion extends BaseEntity {

    @Column(nullable = false)
    @ImportField(name = "Class ID", required = true)
    @ExportField(name = "Class ID")
    Long classId;

    @Column(nullable = false)
    @ImportField(name = "Version Number", required = true)
    @ExportField(name = "Version Number")
    Integer versionNumber;

    @Column(nullable = false, length = 30)
    @ImportField(name = "Status", required = true)
    @ExportField(name = "Status")
    String status; // DRAFT, ACTIVE, ARCHIVED

    @Column(length = 500)
    @ImportField(name = "Note")
    @ExportField(name = "Note")
    String note;

    @Column
    @ExportField(name = "Activated At")
    LocalDateTime activatedAt;
}
