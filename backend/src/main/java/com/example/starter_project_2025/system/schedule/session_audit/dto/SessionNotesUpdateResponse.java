package com.example.starter_project_2025.system.schedule.session_audit.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * T2 / AC T2-01 — Kết quả cập nhật notes: trả lại notes, updatedAt, updatedBy
 * (server-set) và correlation ID để đối chiếu với log (NFR-OBS).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionNotesUpdateResponse {

    Long sessionId;

    SessionStatus status;

    String notes;

    Long version;

    Long updatedBy;

    LocalDateTime updatedAt;

    /** ID dòng {@code session_status_history} vừa tạo (null nếu chỉ sửa notes). */
    Long historyId;

    /** Correlation ID của request (SRS §8.1). */
    String correlationId;

    /** {@code true} khi trả lại kết quả của lần gửi trước với cùng Idempotency-Key. */
    Boolean idempotentReplay;
}
