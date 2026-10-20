package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface SessionRepository extends BaseCrudRepository<Session, Long> {

    List<Session> findByCalendarVersionIdOrderByStartTimeAscIdAsc(Long calendarVersionId);

    @Query("select s.calendarVersion.id from Session s where s.id = :id")
    Optional<Long> findCalendarVersionId(@Param("id") Long id);

    @Query("select s from Session s where s.calendarVersion.calendar.id = :calendarId")
    List<Session> findAllByCalendarId(@Param("calendarId") Long calendarId);

    Optional<Session> findByIdAndIsActiveTrue(Long id);

    @Query("""
        SELECT s FROM Session s
        WHERE s.isActive = true
          AND s.status != com.example.starter_project_2025.system.schedule.session.SessionStatus.CANCELLED
          AND (:excludeId IS NULL OR s.id != :excludeId)
          AND s.startTime < :endTime AND s.endTime > :startTime
          AND (
               s.trainerId = :trainerId
               OR (:room IS NOT NULL AND :room != '' AND s.room = :room)
               OR (:meetingLink IS NOT NULL AND :meetingLink != '' AND s.meetingLink = :meetingLink)
          )
    """)
    List<Session> findConflictingSessions(
            @Param("trainerId") Long trainerId,
            @Param("room") String room,
            @Param("meetingLink") String meetingLink,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludeId") Long excludeId
    );


    List<Session> findByCalendarVersion_IdAndIsActiveTrue(Long calendarVersionId);

    @Query("""
        SELECT s FROM Session s
        JOIN s.calendarVersion cv
        JOIN cv.calendar c
        WHERE s.isActive = true
          AND s.status != com.example.starter_project_2025.system.schedule.session.SessionStatus.CANCELLED
          AND cv.status = com.example.starter_project_2025.system.schedule.calendar.CalendarVersionStatus.ACTIVE
          AND cv.isActive = true
          AND c.isActive = true
          AND (:excludeCalendarId IS NULL OR c.id != :excludeCalendarId)
    """)
    List<Session> findActiveSessionsFromOtherCalendars(@Param("excludeCalendarId") Long excludeCalendarId);

    boolean existsByCalendarVersion_IdAndIsActiveTrueAndStatusNot(
            Long calendarVersionId,
            SessionStatus excludedStatus
    );

}
