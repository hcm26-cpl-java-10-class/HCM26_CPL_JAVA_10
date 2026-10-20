package com.example.starter_project_2025.system.schedule.session_audit.dto;

import com.example.starter_project_2025.system.schedule.session.SessionStatus;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * T2 — Body cho {@code PATCH /api/v1/sessions/{id}/notes}.
 *
 * <pre>{ "status": "COMPLETED", "notes": "Đã dạy bù phần OOP", "reason": null, "version": 3 }</pre>
 *
 * <p>{@code updatedBy}/{@code updatedAt} là trường <b>server-set</b>: nếu client gửi lên thì
 * request bị từ chối 422 VALIDATION_FAILED (fieldErrors.updatedBy / updatedAt).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class UpdateSessionNotesRequest {

    /** Trạng thái đích (tuỳ chọn). Bỏ trống ⇒ chỉ cập nhật notes. */
    SessionStatus status;

    /** Ghi chú buổi học (≤ 2000 ký tự — OD-F15-03). */
    String notes;

    /** Lý do chuyển trạng thái (bắt buộc khi CANCELLED, ≤ 500 ký tự). */
    String reason;

    /** Phiên bản client đang giữ (fallback khi không gửi If-Match). */
    Long version;

    /** Các trường audit do client gửi lên (bị từ chối). */
    @JsonIgnore
    final Map<String, Object> clientSuppliedAuditFields = new LinkedHashMap<>();

    @JsonAnySetter
    public void captureUnknownField(String name, Object value) {
        if (name == null) {
            return;
        }
        String normalized = name.trim();
        if ("updatedBy".equalsIgnoreCase(normalized) || "updatedAt".equalsIgnoreCase(normalized)) {
            clientSuppliedAuditFields.put(normalized, value);
        }
    }
}
