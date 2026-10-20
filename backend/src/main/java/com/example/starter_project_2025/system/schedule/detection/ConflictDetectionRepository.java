package com.example.starter_project_2025.system.schedule.detection;

import com.example.starter_project_2025.system.schedule.session.Session;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;

/** Read-only queries used by the calendar-level conflict check. */
public interface ConflictDetectionRepository extends Repository<Session, Long> {

    @Query("""
            SELECT s
            FROM Session s
            JOIN FETCH s.calendarVersion cv
            JOIN FETCH cv.calendar c
            WHERE cv.id = :calendarVersionId
              AND cv.status = com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus.DRAFT
              AND cv.isActive = true
              AND c.isActive = true
              AND s.isActive = true
              AND s.status <> com.example.starter_project_2025.system.schedule.session.SessionStatus.CANCELLED
            ORDER BY s.id
            """)
    List<Session> findSessionsInDraft(
            @Param("calendarVersionId") Long calendarVersionId
    );

    @Query("""
            SELECT s
            FROM Session s
            JOIN FETCH s.calendarVersion cv
            JOIN FETCH cv.calendar c
            WHERE cv.status = com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus.ACTIVE
              AND cv.isActive = true
              AND c.isActive = true
              AND c.classId <> :excludedClassId
              AND s.isActive = true
              AND s.status <> com.example.starter_project_2025.system.schedule.session.SessionStatus.CANCELLED
            ORDER BY s.id
            """)
    List<Session> findSessionsInActiveVersionsOfOtherClasses(
            @Param("excludedClassId") Long excludedClassId
    );
}
