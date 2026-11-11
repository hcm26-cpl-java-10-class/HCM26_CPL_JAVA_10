package com.example.starter_project_2025.system.demo.session;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.demo.session.Session.SessionStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SessionRepository extends BaseCrudRepository<Session, Long> {
    long countByTeachingAssignmentId(Long assignmentId);

    @Query("""
            select s from Session s where s.teachingAssignmentId = :assignmentId and
            (:trainerChanged = true or (s.status <> :cancelled and
              (s.classId <> :classId or s.trainerId <> :trainerId or s.startTime < :firstStart
                or (:until is not null and s.endTime >= :until))))
            """)
    Page<Session> findAssignmentImpacts(@Param("assignmentId") Long assignmentId,
            @Param("trainerChanged") boolean trainerChanged, @Param("classId") Long classId,
            @Param("trainerId") Long trainerId, @Param("firstStart") LocalDateTime firstStart,
            @Param("until") LocalDateTime until, @Param("cancelled") SessionStatus cancelled, Pageable pageable);

    @Query("select s from Session s where s.teachingAssignmentId = :assignmentId and (:status is null or s.status = :status)")
    Page<Session> findAssignmentSessions(@Param("assignmentId") Long assignmentId,
            @Param("status") SessionStatus status, Pageable pageable);

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

    boolean existsByTopicId(Long topicId);

    @Query("select s from Session s where s.isActive = true and s.status <> :cancelled and s.startTime < :until and s.endTime > :from")
    List<Session> findBlockingInRange(@Param("from") LocalDateTime from, @Param("until") LocalDateTime until,
            @Param("cancelled") Session.SessionStatus cancelled);

    default List<Session> findBlockingInRange(LocalDateTime from, LocalDateTime until) {
        return findBlockingInRange(from, until, Session.SessionStatus.CANCELLED);
    }
}
