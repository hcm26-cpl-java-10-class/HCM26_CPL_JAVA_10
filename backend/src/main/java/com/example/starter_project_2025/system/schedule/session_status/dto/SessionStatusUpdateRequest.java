package com.example.starter_project_2025.system.schedule.session_status.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Body cho {@code PATCH /api/v1/sessions/{id}/status}.
 *
 * <pre>{ "status": "COMPLETED", "notes": "...", "cancelReason": null, "version": 3 }</pre>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionStatusUpdateRequest {

    /** COMPLETED hoặc CANCELLED. */
    SessionStatus status;

    String notes;

    /** Bắt buộc khi {@code status = CANCELLED} (≤ 500 ký tự). */
    String cancelReason;

    /** Phiên bản client đang giữ (fallback khi không gửi If-Match). */
    Long version;
}
