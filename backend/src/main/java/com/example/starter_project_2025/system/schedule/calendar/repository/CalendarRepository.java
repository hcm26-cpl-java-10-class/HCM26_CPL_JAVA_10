package com.example.starter_project_2025.system.schedule.calendar.repository;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.schedule.calendar.Calendar;
import io.lettuce.core.dynamic.annotation.Param;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CalendarRepository extends BaseCrudRepository<Calendar, Long> {

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

}
