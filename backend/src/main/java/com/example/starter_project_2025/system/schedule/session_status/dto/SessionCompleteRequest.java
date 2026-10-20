package com.example.starter_project_2025.system.schedule.session_status.dto;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

/**
 * Body cho {@code POST /api/v1/sessions/{id}/complete} (shortcut hoàn thành).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionCompleteRequest {

    String notes;

    /** Phiên bản client đang giữ (fallback khi không gửi If-Match). */
    Long version;
}
