package com.example.starter_project_2025.system.demo.calendar;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface CalendarRepository extends BaseCrudRepository<TrainingCalendar, Long> {
    boolean existsByClassId(Long classId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from TrainingCalendar c where c.id = :id")
    Optional<TrainingCalendar> findForUpdate(@Param("id") Long id);
}
