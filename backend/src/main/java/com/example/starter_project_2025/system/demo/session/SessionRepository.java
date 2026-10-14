package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

import java.util.List;

@Repository
public interface SessionRepository extends BaseCrudRepository<Session,Long> {

    List<Session> findByClassId(Long classId);

    List<Session> findByCalendarVersionIdOrderByStartTimeAscIdAsc(Long calendarVersionId);

    @Query("select s.calendarVersionId from Session s where s.id = :id")
    Optional<Long> findCalendarVersionId(@Param("id") Long id);

    @Query("select s from Session s where s.calendarVersion.calendarId = :calendarId")
    List<Session> findAllByCalendarId(@Param("calendarId") Long calendarId);
}
