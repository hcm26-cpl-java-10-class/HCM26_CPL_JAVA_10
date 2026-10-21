package com.example.starter_project_2025.system.schedule.session.session_attendance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** T1 / UFR-COM — Outbox event của module điểm danh. */
public interface AttendanceOutboxEventRepository extends JpaRepository<AttendanceOutboxEvent, Long> {

    boolean existsByDedupKey(String dedupKey);

    List<AttendanceOutboxEvent> findByAggregateIdOrderByOccurredAtAscIdAsc(Long aggregateId);

    List<AttendanceOutboxEvent> findByStatusOrderByOccurredAtAscIdAsc(AttendanceOutboxStatus status);
}
