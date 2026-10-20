
package com.example.starter_project_2025.system.schedule.calendar.repository;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface CalendarVersionRepository
        extends BaseCrudRepository<CalendarVersion, Long> {

    @Query("""
        SELECT cv
        FROM CalendarVersion cv
        WHERE cv.calendar.id = :calendarId
          AND cv.status = :status
          AND cv.isActive = true
    """)
    Optional<CalendarVersion> findActiveVersionByCalendarId(
            @Param("calendarId") Long calendarId,
            @Param("status") CalendarVersionStatus status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        SELECT cv
        FROM CalendarVersion cv
        WHERE cv.calendar.id = :calendarId
          AND cv.status = com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus.ACTIVE
          AND cv.isActive = true
    """)
    Optional<CalendarVersion> findActiveVersionByCalendarIdForUpdate(
            @Param("calendarId") Long calendarId
    );

    @Query("""
        SELECT COUNT(cv) > 0
        FROM CalendarVersion cv
        WHERE cv.calendar.id = :calendarId
          AND cv.versionNumber = :versionNumber
    """)
    boolean existsVersionNumber(
            @Param("calendarId") Long calendarId,
            @Param("versionNumber") Integer versionNumber
    );

    Optional<CalendarVersion> findFirstByCalendar_IdAndStatusAndIsActiveTrueOrderByVersionNumberDesc(
            Long calendarId,
            CalendarVersionStatus status
    );

    List<CalendarVersion> findByCalendar_IdInAndStatusAndIsActiveTrue(
            Collection<Long> calendarIds,
            CalendarVersionStatus status
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
    SELECT cv
    FROM CalendarVersion cv
    WHERE cv.id = :versionId
      AND cv.calendar.id = :calendarId
      AND cv.isActive = true
    """)
    Optional<CalendarVersion> findActiveByIdForUpdate(
            @Param("calendarId") Long calendarId,
            @Param("versionId") Long versionId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
    SELECT cv
    FROM CalendarVersion cv
    WHERE cv.id = :versionId
      AND cv.isActive = true
    """)
    Optional<CalendarVersion> findActiveByIdForUpdate(
            @Param("versionId") Long versionId
    );

}
