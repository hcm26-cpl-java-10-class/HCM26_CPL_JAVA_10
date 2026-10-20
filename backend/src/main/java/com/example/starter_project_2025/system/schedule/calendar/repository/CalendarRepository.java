package com.example.starter_project_2025.system.schedule.calendar.repository;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CalendarRepository
        extends BaseCrudRepository<Calendar, Long> {

    Optional<Calendar> findByClassIdAndIsActiveTrue(Long classId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT c
            FROM Calendar c
            WHERE c.id = :calendarId
              AND c.isActive = true
            """)
    Optional<Calendar> findActiveByIdForUpdate(
            @Param("calendarId") Long calendarId
    );

    boolean existsByClassId(Long classId);

    List<Calendar> findByIsActiveTrue();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Calendar c where c.id = :id")
    Optional<Calendar> findForUpdate(@Param("id") Long id);
}
