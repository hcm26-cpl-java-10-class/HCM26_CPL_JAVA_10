package com.example.starter_project_2025.system.schedule.conflict_resolution;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
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
        name = "schedule_conflict_resolution_audit_events",
        indexes = @Index(name = "idx_resolution_audit_time", columnList = "resolution_id,occurred_at")
)
public class ScheduleConflictResolutionAuditEvent extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "resolution_id", nullable = false)
    ScheduleConflictResolution resolution;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    ConflictResolutionAuditAction action;

    @Column(name = "actor_id", nullable = false)
    Long actorId;

    @Column(name = "occurred_at", nullable = false)
    LocalDateTime occurredAt;

    @Column(length = 1000)
    String comment;
}
