package com.example.starter_project_2025.system.demo.calendar_version;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import com.example.starter_project_2025.system.demo.calendar.TrainingCalendar;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Check;
import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@Table(name = "calendar_versions", uniqueConstraints =
        @UniqueConstraint(name = "uk_calendar_version_number", columnNames = {"calendar_id", "version_number"}))
@Check(constraints = "version_number > 0")
@ResourcePermission("CALENDAR_VERSION")
public class CalendarVersion extends BaseEntity {
    @Column(name = "calendar_id", nullable = false, updatable = false)
    private Long calendarId;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calendar_id", insertable = false, updatable = false,
            foreignKey = @ForeignKey(name = "fk_version_calendar"))
    private TrainingCalendar calendar;
    @Column(name = "version_number", nullable = false, updatable = false)
    private Integer versionNumber;
    @Column(nullable = false, length = 150)
    private String name;
    @Column(length = 1000)
    private String description;
    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Transient
    public Status getStatus() {
        if (getId() != null && calendar != null && getId().equals(calendar.getActiveVersionId())) {
            return Status.ACTIVE;
        }
        return publishedAt == null ? Status.DRAFT : Status.INACTIVE;
    }
    public enum Status { DRAFT, ACTIVE, INACTIVE }
}
