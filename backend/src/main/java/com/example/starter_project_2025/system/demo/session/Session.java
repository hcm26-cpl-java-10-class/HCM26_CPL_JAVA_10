package com.example.starter_project_2025.system.demo.session;

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
import java.time.LocalDateTime;
import lombok.experimental.SuperBuilder;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "sessions")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ImportEntity("session")
@ExportEntity(fileName = "class_sessions", sheetName = "Class Sessions")
@ResourcePermission("SESSION")
public class Session extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    @ImportField(name = "Class ID", required = true)
    @ExportField(name = "Class ID")
    Long classId;

    @Column(name = "topic_id", nullable = false)
    @ImportField(name = "Topic ID", required = true)
    @ExportField(name = "Topic ID")
    Long topicId;

    @Column(name = "trainer_id", nullable = false)
    @ImportField(name = "Trainer ID", required = true)
    @ExportField(name = "Trainer ID")
    Long trainerId;

    @Column(nullable = false, length = 150)
    @ImportField(name = "Session Title", required = true)
    @ExportField(name = "Session Title")
    String title;

    @Column(name = "start_time", nullable = false)
    @ImportField(name = "Start Time", required = true)
    @ExportField(name = "Start Time")
    LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    @ImportField(name = "End Time", required = true)
    @ExportField(name = "End Time")
    LocalDateTime endTime;

    @Column(length = 150)
    @ImportField(name = "Location / Room")
    @ExportField(name = "Location / Room")
    String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @ExportField(name = "Status")
    SessionStatus status;

    @Column(columnDefinition = "TEXT")
    @ExportField(name = "Note")
    String note;

    @Column(name = "cancel_reason", length = 255)
    @ExportField(name = "Cancel Reason")
    String cancelReason;

    /**
     * Last line of defence for writers that bypass the service layer (e.g. the generic file import):
     * a row never reaches the database without a status or with an end before its start.
     */
    @PrePersist
    @PreUpdate
    void ensureValidState() {
        if (status == null) {
            status = SessionStatus.SCHEDULED;
        }
        if (startTime != null && endTime != null && !endTime.isAfter(startTime)) {
            throw new IllegalStateException("End time must be after start time");
        }
    }

    public enum SessionStatus {
        SCHEDULED,
        COMPLETED,
        CANCELLED
    }
}
