package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.system.schedule.dto.ConflictCheckResponse;
import com.example.starter_project_2025.system.schedule.dto.SessionCancelRequest;

public interface SessionService extends BaseCrudService<Long, SessionDTO, SessionFilter> {
    ConflictCheckResponse checkConflict(SessionDTO request, Long excludeId);

    /**
     * Hủy một buổi học (F15): chuyển một chiều SCHEDULED -&gt; CANCELLED (BR-SES-02/03).
     *
     * @param id              id buổi học
     * @param request         lý do hủy (bắt buộc) và ghi chú tùy chọn
     * @param expectedVersion phiên bản client đang giữ (từ If-Match/ETag), có thể null
     * @return buổi học sau khi hủy
     */

}
