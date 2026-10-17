package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("session")
@ExportEntity(fileName = "sessions", sheetName = "Sessions")
@ResourcePermission("SESSION")
@ResourceMenu(
        title = "Class Schedules",
        group = "Training Management",
        icon = "calendar",
        url = "/sessions",
        order = 3,
        permission = "SESSION_READ"
)
public class Session extends BaseEntity {

    @Column(name = "calendar_version_id", nullable = false)
    @ImportField(name = "Calendar Version ID", required = true)
    @ExportField(name = "Calendar Version ID")
    Long calendarVersionId;

    @Column(name = "topic_id", nullable = false)
    @ImportField(name = "Topic ID", required = true)
    @ExportField(name = "Topic ID")
    Long topicId;

    @Column(name = "trainer_id", nullable = false)
    @ImportField(name = "Trainer ID", required = true)
    @ExportField(name = "Trainer ID")
    Long trainerId;

    @Column(nullable = false, length = 150)
    @ImportField(name = "Title", required = true)
    @ExportField(name = "Title")
    String title;

    @Column(name = "start_time", nullable = false)
    @ImportField(name = "Start Time", required = true)
    @ExportField(name = "Start Time")
    LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    @ImportField(name = "End Time", required = true)
    @ExportField(name = "End Time")
    LocalDateTime endTime;

    @Column(length = 80)
    @ImportField(name = "Room")
    @ExportField(name = "Room")
    String room;

    @Column(name = "meeting_link", length = 255)
    @ImportField(name = "Meeting Link")
    @ExportField(name = "Meeting Link")
    String meetingLink;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @ExportField(name = "Status")
    SessionStatus status = SessionStatus.SCHEDULED;

    @Column(columnDefinition = "TEXT")
    @ExportField(name = "Notes")
    String notes;

    @Column(name = "cancel_reason", length = 500)
    @ExportField(name = "Cancel Reason")
    String cancelReason;

    @Version
    @Column(name = "version")
    @ExportField(name = "Version")
    Long version;
}
