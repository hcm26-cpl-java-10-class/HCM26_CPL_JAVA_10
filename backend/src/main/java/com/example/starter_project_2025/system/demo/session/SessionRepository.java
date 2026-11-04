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

    boolean existsByTopicId(Long topicId);

    /**
     * Active, non-cancelled sessions whose time range overlaps [start, end) and that belong to the
     * same class or are taught by the same trainer. Adjacent ranges (end == other start) do not overlap.
     */
    @Query("""
            select s from Session s
            where s.isActive = true
              and s.status <> :cancelled
              and s.id <> :excludeId
              and s.startTime < :end
              and s.endTime > :start
              and (s.classId = :classId or s.trainerId = :trainerId)
            order by s.startTime
            """)
    List<Session> findOverlappingForClassOrTrainer(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("classId") Long classId,
            @Param("trainerId") Long trainerId,
            @Param("excludeId") Long excludeId,
            @Param("cancelled") Session.SessionStatus cancelled);

    /** Same overlap rule, restricted to sessions held in the given room (case-insensitive). */
    @Query("""
            select s from Session s
            where s.isActive = true
              and s.status <> :cancelled
              and s.id <> :excludeId
              and s.startTime < :end
              and s.endTime > :start
              and lower(s.location) = lower(:location)
            order by s.startTime
            """)
    List<Session> findOverlappingAtLocation(
            @Param("start") LocalDateTime start,
            @Param("end") LocalDateTime end,
            @Param("location") String location,
            @Param("excludeId") Long excludeId,
            @Param("cancelled") Session.SessionStatus cancelled);
}
