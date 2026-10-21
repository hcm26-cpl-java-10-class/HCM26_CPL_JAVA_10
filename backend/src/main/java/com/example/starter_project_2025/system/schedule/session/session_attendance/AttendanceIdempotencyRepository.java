package com.example.starter_project_2025.system.schedule.session.session_attendance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/** T1 / BR-UNI-20 — Idempotency-Key của các request ghi điểm danh. */
public interface AttendanceIdempotencyRepository extends JpaRepository<AttendanceIdempotencyRecord, Long> {

    Optional<AttendanceIdempotencyRecord> findByIdempotencyKey(String idempotencyKey);
}
