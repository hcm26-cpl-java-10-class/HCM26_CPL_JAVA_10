package com.example.starter_project_2025.system.schedule.generation;

import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkPreviewResponseDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsRequestDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.BulkSaveSessionsResponseDTO;
import com.example.starter_project_2025.system.schedule.generation.dto.ScheduleGenerationContextResponse;

public interface BulkSessionGenerationService {

    /**
     * Tải kế hoạch môn học và phân công giảng viên của lớp để làm ngữ cảnh sinh lịch.
     */
    ScheduleGenerationContextResponse getGenerationContext(Long classId);

    /**
     * Tính toán danh sách buổi học dự kiến trên RAM, kiểm tra xung đột tạm thời.
     */
    BulkPreviewResponseDTO generatePreview(Long classId, BulkPreviewRequestDTO request);

    /**
     * Lưu lô các buổi học vào hệ thống (All-or-Nothing, chống gửi lặp bằng idempotencyKey).
     */
    BulkSaveSessionsResponseDTO saveBulkSessions(Long classId, BulkSaveSessionsRequestDTO request, String idempotencyKey);
}
