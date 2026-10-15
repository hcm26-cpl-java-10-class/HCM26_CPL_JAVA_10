package com.example.starter_project_2025.system.schedule.calendar;

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

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "calendarVersions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("calendarVersion")
@ExportEntity(fileName = "calendarVersions", sheetName = "CalendarVersions")
@ResourcePermission("CALENDARVERSION")
public class CalendarVersion extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calendar_id", nullable = false)
    @ExportField(name = "Calendar ID")
    Calendar calendar;

    @Column(name = "version_number", nullable = false)
    @ExportField(name = "Version Number")
    Integer versionNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ExportField(name = "Status")
    CalendarVersionStatus status;

    @ExportField(name = "Activated At")
    LocalDateTime activatedAt;

    @ExportField(name = "Activated By")
    Long activatedBy;
}
