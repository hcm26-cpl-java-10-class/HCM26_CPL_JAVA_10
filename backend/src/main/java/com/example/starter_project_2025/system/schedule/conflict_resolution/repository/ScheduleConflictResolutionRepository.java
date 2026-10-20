package com.example.starter_project_2025.system.schedule.conflict_resolution.repository;

import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionReason;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ConflictResolutionStatus;
import com.example.starter_project_2025.system.schedule.conflict_resolution.ScheduleConflictResolution;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ScheduleConflictResolutionRepository
        extends JpaRepository<ScheduleConflictResolution, Long> {

    List<ScheduleConflictResolution> findByCalendarVersion_IdAndIsActiveTrueOrderByCreatedAtDesc(
            Long calendarVersionId
    );

    List<ScheduleConflictResolution> findByCalendarVersion_IdAndStatusInAndIsActiveTrue(
            Long calendarVersionId,
            Collection<ConflictResolutionStatus> statuses
    );

    Optional<ScheduleConflictResolution> findByIdAndCalendarVersion_IdAndIsActiveTrue(
            Long id,
            Long calendarVersionId
    );

    List<ScheduleConflictResolution> findByCalendarVersion_IdAndSessionA_IdAndSessionB_IdAndReasonCodeAndStatusInAndIsActiveTrue(
            Long calendarVersionId,
            Long sessionAId,
            Long sessionBId,
            ConflictResolutionReason reasonCode,
            Collection<ConflictResolutionStatus> statuses
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT resolution
            FROM ScheduleConflictResolution resolution
            WHERE resolution.id = :resolutionId
              AND resolution.calendarVersion.id = :calendarVersionId
              AND resolution.isActive = true
            """)
    Optional<ScheduleConflictResolution> findForUpdate(
            @Param("calendarVersionId") Long calendarVersionId,
            @Param("resolutionId") Long resolutionId
    );
}
