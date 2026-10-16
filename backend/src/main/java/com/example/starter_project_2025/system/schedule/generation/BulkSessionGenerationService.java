package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.generation.dto.*;

public interface BulkSessionGenerationService {

    /**
     * US-F16-01: Lấy danh sách Topic theo thứ tự và Trainer đã phân công của lớp học
     */
    ScheduleGenerationContextResponse getGenerationContext(Long classId);

    /**
     * US-F16-02: Tính toán phân bổ lịch học dự kiến trên RAM
     */
    BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request);

    /**
     * US-F16-05: Lưu hàng loạt danh sách Session vào CalendarVersion DRAFT (All-or-Nothing)
     */
    BulkSaveSessionsResponseDTO saveBulkSessions(Long versionId, BulkSaveSessionsRequestDTO request, String idempotencyKey);
}
