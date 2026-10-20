package com.example.starter_project_2025.system.schedule.calendar;

import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

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
import java.time.LocalDate;
import org.hibernate.annotations.Check;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "calendars")
@Check(constraints = "class_end_date >= class_start_date")
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
    @Builder.Default
    Integer lastIssuedVersionNumber = 0;

    @Column(name = "class_start_date")
    LocalDate classStartDate;

    @Column(name = "class_end_date")
    LocalDate classEndDate;

    @Column(name = "active_version_id")
    Long activeVersionId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "active_version_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_calendar_active_version"))
    CalendarVersion activeVersion;

    // Keep the existing counter so upgrading an existing calendar never reuses a number.
    @Builder.Default
    @Column(name = "next_version_number")
    Integer nextVersionNumber = 1;

    public Integer getNextVersionNumber() {
        return Math.max(nextVersionNumber == null ? 1 : nextVersionNumber,
                Math.addExact(lastIssuedVersionNumber == null ? 0 : lastIssuedVersionNumber, 1));
    }

    public void setNextVersionNumber(Integer value) {
        nextVersionNumber = value;
        lastIssuedVersionNumber = value - 1;
    }

    @Column(nullable = false, length = 150)
    @ImportField(name = "Name", required = true)
    @ExportField(name = "Name")
    String name;

    @Column(length = 1000)
    @ImportField(name = "Description")
    @ExportField(name = "Description")
    String description;
}
