package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.base.dataio.importer.annotation.ImportField;
import com.example.starter_project_2025.base.dataio.template.annotation.ImportEntity;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.proxy.HibernateProxy;

import java.time.LocalDateTime;
import java.util.Objects;

@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
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

    @Setter(AccessLevel.NONE)
    @Column(name = "start_time", nullable = false)
    @ImportField(name = "Start Time", required = true)
    @ExportField(name = "Start Time")
    LocalDateTime startTime;

    @Setter(AccessLevel.NONE)
    @Column(name = "end_time", nullable = false)
    @ImportField(name = "End Time", required = true)
    @ExportField(name = "End Time")
    LocalDateTime endTime;

    @Column(length = 150)
    @ImportField(name = "Location / Room")
    @ExportField(name = "Location / Room")
    String location;

    @Setter(AccessLevel.NONE)
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    @ExportField(name = "Status")
    SessionStatus status;

    @Column(columnDefinition = "TEXT")
    @ExportField(name = "Note")
    String note;

    @Setter(AccessLevel.NONE)
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
        validateStateInvariants();
    }

    private void validateStateInvariants() {
        if (startTime != null && endTime != null && !endTime.isAfter(startTime)) {
            throw new IllegalStateException("End time must be after start time");
        }
        if (status == SessionStatus.CANCELLED) {
            if (cancelReason == null || cancelReason.isBlank()) {
                throw new IllegalStateException("Cancel reason is required for cancelled sessions");
            }
            cancelReason = cancelReason.trim();
        } else {
            cancelReason = null;
        }
    }

    public abstract static class SessionBuilder<C extends Session, B extends SessionBuilder<C, B>>
            extends BaseEntity.BaseEntityBuilder<C, B> {
    }

    private static final class SessionBuilderImpl extends SessionBuilder<Session, SessionBuilderImpl> {
        @Override
        public Session build() {
            Session session = new Session(this);
            session.validateStateInvariants();
            return session;
        }
    }

    public void initializeForSchedule(String trimmedTitle, String normalizedLocation) {
        if (this.status != null && this.status != SessionStatus.SCHEDULED) {
            throw new ConflictException("Only new or scheduled sessions can be initialized for schedule (current status: " + this.status + ")");
        }
        if (trimmedTitle == null || trimmedTitle.isBlank()) {
            throw new BadRequestException("Title is required");
        }
        this.title = trimmedTitle.trim();
        this.location = normalizedLocation;
        this.status = SessionStatus.SCHEDULED;
        this.isActive = true;
        this.cancelReason = null;
    }

    public void updateScheduleDetails(String trimmedTitle, String normalizedLocation) {
        requireScheduled("updated");
        if (trimmedTitle != null) {
            if (trimmedTitle.isBlank()) {
                throw new BadRequestException("Title is required");
            }
            this.title = trimmedTitle.trim();
        }
        if (normalizedLocation != null || this.location != null) {
            this.location = normalizedLocation;
        }
    }

    /** Atomically validates and assigns a new [startTime, endTime) slot for a new or scheduled session. */
    public void scheduleSlot(LocalDateTime newStartTime, LocalDateTime newEndTime) {
        if (this.status != null && this.status != SessionStatus.SCHEDULED) {
            throw new ConflictException("Only scheduled sessions can change time slot (current status: " + this.status + ")");
        }
        validateTimeSlot(newStartTime, newEndTime);
        this.startTime = newStartTime;
        this.endTime = newEndTime;
        if (this.status == null) {
            this.status = SessionStatus.SCHEDULED;
        }
    }

    public void cancel(String reason) {
        if (this.status == SessionStatus.COMPLETED) {
            throw new ConflictException("Cannot cancel an already completed session");
        }
        if (this.status == SessionStatus.CANCELLED) {
            throw new ConflictException("Session is already cancelled");
        }
        requireScheduled("cancelled");
        if (reason == null || reason.isBlank()) {
            throw new BadRequestException("Cancel reason is required");
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
        requireScheduled("completed");
        this.status = SessionStatus.COMPLETED;
    }

    public void rescheduleTo(LocalDateTime newStartTime, LocalDateTime newEndTime, String newLocation) {
        requireScheduled("rescheduled");
        validateTimeSlot(newStartTime, newEndTime);
        this.startTime = newStartTime;
        this.endTime = newEndTime;
        this.location = newLocation;
    }

    public Session duplicateTo(LocalDateTime newStartTime, LocalDateTime newEndTime, String newLocation) {
        validateTimeSlot(newStartTime, newEndTime);
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

    private static void validateTimeSlot(LocalDateTime start, LocalDateTime end) {
        if (start == null || end == null) {
            throw new BadRequestException("Start time and end time are required");
        }
        if (!end.isAfter(start)) {
            throw new BadRequestException("End time must be after start time");
        }
    }

    @Override
    public final boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (other == null) {
            return false;
        }
        Class<?> thisEffectiveClass = effectiveClass(this);
        Class<?> otherEffectiveClass = effectiveClass(other);
        if (thisEffectiveClass != otherEffectiveClass) {
            return false;
        }
        Session that = (Session) other;
        Long thisId = this.getId();
        return thisId != null && Objects.equals(thisId, that.getId());
    }

    @Override
    public final int hashCode() {
        return effectiveClass(this).hashCode();
    }

    private static Class<?> effectiveClass(Object obj) {
        return obj instanceof HibernateProxy proxy
                ? proxy.getHibernateLazyInitializer().getPersistentClass()
                : obj.getClass();
    }

    public enum SessionStatus {
        SCHEDULED,
        COMPLETED,
        CANCELLED
    }
}
