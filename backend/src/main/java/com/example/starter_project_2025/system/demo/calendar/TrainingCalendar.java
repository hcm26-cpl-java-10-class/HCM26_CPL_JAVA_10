package com.example.starter_project_2025.system.demo.calendar;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.calendar_version.CalendarVersion;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Check;
import java.time.LocalDate;

@Entity
@Getter
@Setter
@Table(name = "calendars", uniqueConstraints = @UniqueConstraint(name = "uk_calendar_class", columnNames = "class_id"))
@Check(constraints = "class_end_date >= class_start_date")
@ResourcePermission("CALENDAR")
@ResourceMenu(title = "Training Calendars", group = "Training Operations", icon = "calendar",
        url = "/calendars", order = 4, permission = "CALENDAR_READ")
public class TrainingCalendar extends BaseEntity {
    @Column(name = "class_id", nullable = false, updatable = false)
    private Long classId;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 1000)
    private String description;
    @Column(name = "class_start_date", nullable = false)
    private LocalDate classStartDate;
    @Column(name = "class_end_date", nullable = false)
    private LocalDate classEndDate;
    @Column(name = "active_version_id")
    private Long activeVersionId;

    // Read-only association supplies the FK; only the activation service writes the ID.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "active_version_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_calendar_active_version"))
    private CalendarVersion activeVersion;

    // Never reuse a published/deleted version number.
    @Column(name = "next_version_number", nullable = false)
    private Integer nextVersionNumber = 1;
}
