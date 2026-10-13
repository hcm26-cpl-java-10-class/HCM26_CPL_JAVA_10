package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends BaseCrudRepository<Session,Long> {

    List<Session> findByClassId(Long classId);

    @Query("""
            select s from Session s
            where s.classId = :classId
              and s.status <> :excludedStatus
              and (:excludedSessionId is null or s.id <> :excludedSessionId)
              and s.startTime < :endTime
              and s.endTime > :startTime
            """)
    List<Session> findClassConflicts(
            @Param("classId") Long classId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludedSessionId") Long excludedSessionId,
            @Param("excludedStatus") Session.SessionStatus excludedStatus);

    @Query("""
            select s from Session s
            where s.trainerId = :trainerId
              and s.status <> :excludedStatus
              and (:excludedSessionId is null or s.id <> :excludedSessionId)
              and s.startTime < :endTime
              and s.endTime > :startTime
            """)
    List<Session> findTrainerConflicts(
            @Param("trainerId") Long trainerId,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludedSessionId") Long excludedSessionId,
            @Param("excludedStatus") Session.SessionStatus excludedStatus);

    @Query("""
            select s from Session s
            where lower(trim(s.location)) = lower(trim(:location))
              and s.status <> :excludedStatus
              and (:excludedSessionId is null or s.id <> :excludedSessionId)
              and s.startTime < :endTime
              and s.endTime > :startTime
            """)
    List<Session> findRoomConflicts(
            @Param("location") String location,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            @Param("excludedSessionId") Long excludedSessionId,
            @Param("excludedStatus") Session.SessionStatus excludedStatus);
}
