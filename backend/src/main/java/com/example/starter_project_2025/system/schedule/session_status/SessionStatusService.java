package com.example.starter_project_2025.system.schedule.session_status;

import com.example.starter_project_2025.system.schedule.session.dto.SessionCancelRequest;
import com.example.starter_project_2025.system.schedule.session.dto.SessionDTO;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionCompleteRequest;
import com.example.starter_project_2025.system.schedule.session_status.dto.SessionStatusUpdateRequest;

/**
 * F15 — Session Operational Status (API v1).
 *
 * <p>Bốn thao tác theo đặc tả:</p>
 * <ul>
 *     <li>{@code GET  /api/v1/sessions/{id}} — đọc lại trạng thái.</li>
 *     <li>{@code PATCH /api/v1/sessions/{id}/status} — đổi trạng thái (endpoint chính).</li>
 *     <li>{@code POST /api/v1/sessions/{id}/complete} — shortcut hoàn thành.</li>
 *     <li>{@code POST /api/v1/sessions/{id}/cancel} — shortcut hủy (bắt buộc lý do).</li>
 * </ul>
 */
public interface SessionStatusService {

    SessionDTO getStatus(Long id);

    SessionDTO changeStatus(Long id, SessionStatusUpdateRequest request, Long expectedVersion);

    SessionDTO complete(Long id, SessionCompleteRequest request, Long expectedVersion);

    SessionDTO cancel(Long id, SessionCancelRequest request, Long expectedVersion);
}