
package com.example.starter_project_2025.system.schedule.calendar.repository;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersion;
import com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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
}
