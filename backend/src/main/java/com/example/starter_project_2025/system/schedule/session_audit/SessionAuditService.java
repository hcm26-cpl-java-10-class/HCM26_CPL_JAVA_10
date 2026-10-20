package com.example.starter_project_2025.system.schedule.session_audit;

import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogQuery;
import com.example.starter_project_2025.system.schedule.session_audit.dto.AuditLogResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionNotesUpdateResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.SessionStatusHistoryResponse;
import com.example.starter_project_2025.system.schedule.session_audit.dto.UpdateSessionNotesRequest;
import org.springframework.data.domain.Page;

import java.util.List;

/**
 * T2 / US-F15-02 — Cập nhật notes và audit thông tin người cập nhật/thời điểm.
 */
public interface SessionAuditService {

    /**
     * Ghi notes (kèm transition nếu body có {@code status}) và tự động ghi
     * audit + history + {@code updatedBy}/{@code updatedAt} (server-set).
     *
     * @param sessionId       id buổi học
     * @param request         payload (notes/status/reason/version)
     * @param expectedVersion version từ {@code If-Match} (ưu tiên) hoặc body
     * @param idempotencyKey  {@code Idempotency-Key} header (có thể null)
     */
    SessionNotesUpdateResponse updateNotes(Long sessionId,
                                           UpdateSessionNotesRequest request,
                                           Long expectedVersion,
                                           String idempotencyKey);

    /**
     * Lịch sử chuyển trạng thái (chỉ đọc) — chỉ Trainer được phân công / Class Admin.
     */
    List<SessionStatusHistoryResponse> getHistory(Long sessionId);

    /**
     * Tra cứu audit log (UFR-SYS-014 AC1–AC2).
     */
    Page<AuditLogResponse> searchAuditLogs(AuditLogQuery query);

    /**
     * Export audit log ra CSV (UFR-SYS-014 AC3).
     */
    String exportAuditLogsCsv(AuditLogQuery query);
}
