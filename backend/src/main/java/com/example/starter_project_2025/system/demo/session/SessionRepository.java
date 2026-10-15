package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.session.Session.SessionStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends BaseCrudRepository<Session, Long> {

    List<Session> findByClassId(Long classId);

    @Query("""
            select s from Session s
            where s.isActive = true
              and s.status <> :cancelled
              and s.startTime < :candidateEnd
              and s.endTime > :candidateStart
              and (s.classId = :classId
                   or s.trainerId = :trainerId
                   or (:location is not null and lower(s.location) = lower(:location)))
              and (:excludedSessionId is null or s.id <> :excludedSessionId)
            """)
    List<Session> findOverlappingSessions(
            @Param("classId") Long classId,
            @Param("trainerId") Long trainerId,
            @Param("location") String location,
            @Param("candidateStart") LocalDateTime candidateStart,
            @Param("candidateEnd") LocalDateTime candidateEnd,
            @Param("excludedSessionId") Long excludedSessionId,
            @Param("cancelled") SessionStatus cancelled);
}
