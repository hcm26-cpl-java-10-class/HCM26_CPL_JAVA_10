package com.example.starter_project_2025.system.demo.calendar_version;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;
public interface CalendarVersionRepository extends BaseCrudRepository<CalendarVersion, Long> {
    boolean existsByCalendarId(Long calendarId);
    @Query("select v.calendarId from CalendarVersion v where v.id = :id")
    Optional<Long> findCalendarId(@Param("id") Long id);
}
