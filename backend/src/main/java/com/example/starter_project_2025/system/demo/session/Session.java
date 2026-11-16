package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

@Entity
@Data
@ToString(callSuper = true)
@EqualsAndHashCode(callSuper = false)
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "sessions", indexes = {
        @Index(name = "idx_sessions_class_start", columnList = "class_id, start_time"),
        @Index(name = "idx_sessions_trainer_start", columnList = "trainer_id, start_time"),
        @Index(name = "idx_sessions_status_end", columnList = "status, end_time")
})
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

    @Column(name = "title", nullable = false, length = 150)
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

    @Column(name = "location", length = 150)
    @ImportField(name = "Location / Room")
    @ExportField(name = "Location / Room")
    String location;

    @Builder.Default
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 30)
    @ExportField(name = "Status")
    SessionStatus status = SessionStatus.SCHEDULED;

    @Column(name = "note", columnDefinition = "TEXT")
    @ExportField(name = "Note")
    String note;

    @Column(name = "cancel_reason", length = 255)
    @ExportField(name = "Cancel Reason")
    String cancelReason;

    /**
     * Last line of defence for writers that bypass the service layer (e.g. the
     * generic file
     * import): a row never reaches the database without a status, with an end
     * before its start,
     * or cancelled without a reason.
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
        if (status == SessionStatus.CANCELLED && (cancelReason == null || cancelReason.isBlank())) {
            throw new IllegalStateException("Cancel reason is required for a cancelled session");
        }
    }

    public void initializeForSchedule(String trimmedTitle, String normalizedLocation) {
        this.title = trimmedTitle;
        this.location = normalizedLocation;
        this.status = SessionStatus.SCHEDULED;
        this.isActive = true;
        this.cancelReason = null;
    }

    public void updateScheduleDetails(String trimmedTitle, String normalizedLocation) {
        if (trimmedTitle != null) {
            this.title = trimmedTitle;
        }
        if (normalizedLocation != null || this.location != null) {
            this.location = normalizedLocation;
        }
    }

    public void cancel(String reason) {
        if (this.status == SessionStatus.COMPLETED) {
            throw new ConflictException("Cannot cancel an already completed session");
        }
        if (this.status == SessionStatus.CANCELLED) {
            throw new ConflictException("Session is already cancelled");
        }
        this.status = SessionStatus.CANCELLED;
        this.cancelReason = reason.trim();
    }

    public void complete() {
        if (this.status == SessionStatus.COMPLETED) {
            throw new ConflictException("Session is already completed");
        }
        if (this.status == SessionStatus.CANCELLED) {
            throw new ConflictException("Cannot complete a cancelled session");
        }
        this.status = SessionStatus.COMPLETED;
    }

    public void rescheduleTo(LocalDateTime newStartTime, LocalDateTime newEndTime, String newLocation) {
        requireScheduled("rescheduled");
        this.startTime = newStartTime;
        this.endTime = newEndTime;
        this.location = newLocation;
    }

    public Session duplicateTo(LocalDateTime newStartTime, LocalDateTime newEndTime, String newLocation) {
        return Session.builder()
                .classId(this.classId)
                .topicId(this.topicId)
                .trainerId(this.trainerId)
                .title(this.title)
                .startTime(newStartTime)
                .endTime(newEndTime)
                .location(newLocation)
                .note(this.note)
                .status(SessionStatus.SCHEDULED)
                .isActive(true)
                .build();
    }

    void requireScheduled(String action) {
        if (this.status != SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled sessions can be " + action
                    + " (current status: " + this.status + ")");
        }
    }

    public enum SessionStatus {
        SCHEDULED,
        COMPLETED,
        CANCELLED
    }
}