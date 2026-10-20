package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.session.Session;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
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
@FieldDefaults(level = AccessLevel.PRIVATE)
@Table(
        name = "schedule_conflict_resolutions",
        indexes = {
                @Index(name = "idx_resolution_version_status", columnList = "calendar_version_id,status"),
                @Index(name = "idx_resolution_session_pair", columnList = "session_a_id,session_b_id")
        }
)
public class ScheduleConflictResolution extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "calendar_version_id", nullable = false)
    CalendarVersion calendarVersion;

    /** Canonical pair: sessionA.id is always lower than sessionB.id. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_a_id", nullable = false)
    Session sessionA;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "session_b_id", nullable = false)
    Session sessionB;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", nullable = false, length = 60)
    ConflictResolutionReason reasonCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    ConflictResolutionStatus status;

    @Column(name = "trainer_conflict_detected", nullable = false)
    boolean trainerConflictDetected;

    @Column(name = "room_conflict_detected", nullable = false)
    boolean roomConflictDetected;

    @Column(name = "trainer_conflict_waived", nullable = false)
    boolean trainerConflictWaived;

    @Column(name = "room_conflict_waived", nullable = false)
    boolean roomConflictWaived;

    @Column(nullable = false, length = 1000)
    String justification;

    @Column(name = "reference_code", length = 120)
    String referenceCode;

    @Column(name = "session_area", length = 120)
    String sessionArea;

    @Column(name = "conflicting_session_area", length = 120)
    String conflictingSessionArea;

    @Column(name = "expected_resolution_at")
    LocalDateTime expectedResolutionAt;

    @Column(name = "session_a_version")
    Long sessionAVersion;

    @Column(name = "session_b_version")
    Long sessionBVersion;

    @Column(name = "requested_by", nullable = false)
    Long requestedBy;

    @Column(name = "requested_at", nullable = false)
    LocalDateTime requestedAt;

    @Column(name = "approved_by")
    Long approvedBy;

    @Column(name = "approved_at")
    LocalDateTime approvedAt;

    @Column(name = "rejected_by")
    Long rejectedBy;

    @Column(name = "rejected_at")
    LocalDateTime rejectedAt;

    @Column(name = "rejection_reason", length = 500)
    String rejectionReason;

    @Column(name = "revoked_by")
    Long revokedBy;

    @Column(name = "revoked_at")
    LocalDateTime revokedAt;

    @Column(name = "revocation_reason", length = 500)
    String revocationReason;

    @Column(name = "applied_by")
    Long appliedBy;

    @Column(name = "applied_at")
    LocalDateTime appliedAt;

    // Immutable conflict snapshot captured by the server at request time.
    @Column(name = "session_a_start")
    LocalDateTime sessionAStart;

    @Column(name = "session_a_end")
    LocalDateTime sessionAEnd;

    @Column(name = "session_a_trainer_id")
    Long sessionATrainerId;

    @Column(name = "session_a_room", length = 80)
    String sessionARoom;

    @Column(name = "session_a_class_id")
    Long sessionAClassId;

    @Column(name = "session_b_start")
    LocalDateTime sessionBStart;

    @Column(name = "session_b_end")
    LocalDateTime sessionBEnd;

    @Column(name = "session_b_trainer_id")
    Long sessionBTrainerId;

    @Column(name = "session_b_room", length = 80)
    String sessionBRoom;

    @Column(name = "session_b_class_id")
    Long sessionBClassId;

    @Version
    @Column(name = "lock_version")
    Long lockVersion;
}
