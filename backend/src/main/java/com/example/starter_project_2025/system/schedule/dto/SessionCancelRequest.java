package com.example.starter_project_2025.system.schedule.dto;

import lombok.*;
import lombok.experimental.FieldDefaults;

/**
 * Request body cho {@code POST /api/v1/sessions/{id}/cancel} (F15 — UFR-PEO-014).
 *
 * <p>Lý do hủy được validate ở tầng service để trả về đúng mã 422 VALIDATION_FAILED
 * kèm {@code fieldErrors.cancelReason} (BR-SES-03).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class SessionCancelRequest {

    /** Lý do hủy — bắt buộc khi CANCELLED, tối đa 500 ký tự (BR-SES-03). */
    String cancelReason;

    /** Ghi chú bổ sung cho buổi học (tùy chọn). */
    String notes;

    /** Phiên bản client đang giữ, dùng khi không truyền header If-Match. */
    Long version;
}
