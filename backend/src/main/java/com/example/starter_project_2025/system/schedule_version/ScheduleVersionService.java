package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;
import java.util.Optional;

/**
 * Interface nghiệp vụ cho ScheduleVersion.
 * Chủ sở hữu: Phát
 */
public interface ScheduleVersionService extends BaseCrudService<Long, ScheduleVersionDTO, ScheduleVersionFilter> {

    /** Tạo bản nháp rỗng cho lớp. Chặn 409 nếu đã có DRAFT. */
    ScheduleVersionDTO createDraft(String classId, String note);

    /** Clone phiên bản nguồn sang bản DRAFT mới. Chặn 409 nếu đã có DRAFT. */
    ScheduleVersionDTO cloneVersion(Long sourceVersionId, String note);

    /** Lấy toàn bộ phiên bản của lớp (tăng dần). */
    List<ScheduleVersionDTO> getVersionsByClass(String classId);

    /** Lấy bản ACTIVE của lớp. */
    Optional<ScheduleVersionDTO> getActiveVersion(String classId);

    /** Guard kiểm tra phiên bản có cho phép sửa buổi học không (isEditable=true khi DRAFT). */
    ScheduleVersionDTO getEditableStatus(Long versionId);

    /** Lấy lịch sử phiên bản của lớp (giảm dần). */
    List<ScheduleVersionDTO> getHistory(String classId);

    /** Xóa bản DRAFT. Chặn nếu không phải DRAFT. */
    void deleteDraft(Long id);

    /**
     * Kích hoạt phiên bản DRAFT → ACTIVE (nguyên tử).
     * - Kiểm tra xung đột lịch trước (gọi ScheduleConflictService).
     * - Archive bản ACTIVE cũ.
     * - Đặt bản này thành ACTIVE, lưu activatedAt, activatedBy.
     * Chặn 409 khi có xung đột. Rollback nếu lỗi.
     */
    ScheduleVersionDTO activateVersion(Long versionId, String activationReason);

    /**
     * Kiểm tra xung đột lịch toàn bộ phiên bản (không ghi dữ liệu).
     * Trả về { valid, issues }.
     */
    ScheduleVersionValidationResult validateVersion(Long versionId);
}
