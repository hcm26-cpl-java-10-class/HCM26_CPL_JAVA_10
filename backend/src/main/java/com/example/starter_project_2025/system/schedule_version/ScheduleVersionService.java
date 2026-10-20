package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.service.BaseCrudService;

import java.util.List;
import java.util.Optional;

/**
 * Interface nghiệp vụ cho ScheduleVersion.
 * Chủ sở hữu: Phát
 *
 * Tuần 2 (luồng cơ bản):
 *   - createDraft: tạo bản nháp rỗng
 *   - cloneVersion: clone bản hiện tại sang bản nháp mới
 *   - getVersionsByClass: lấy danh sách phiên bản của lớp
 *   - getActiveVersion: lấy bản ACTIVE của lớp (Tân dùng)
 *   - getEditableStatus: guard kiểm tra quyền sửa (Danh dùng)
 *
 * Tuần 3 (sẽ bổ sung):
 *   - validateVersion, activateVersion, getHistory
 */
public interface ScheduleVersionService extends BaseCrudService<Long, ScheduleVersionDTO, ScheduleVersionFilter> {

    /**
     * Tạo một phiên bản lịch nháp rỗng cho lớp học.
     * versionNumber tự động = max(versionNumber của lớp) + 1.
     * Chặn 409 nếu lớp đã có bản DRAFT đang mở.
     *
     * @param classId ID lớp học (String theo quy ước nhóm)
     * @param note    Ghi chú tuỳ chọn
     * @return DTO của bản nháp vừa tạo
     */
    ScheduleVersionDTO createDraft(String classId, String note);

    /**
     * Clone một phiên bản (thường là ACTIVE) thành một bản nháp mới.
     * Sao chép toàn bộ metadata; các buổi học (StudySession) sẽ được
     * Danh copy sang trong luồng tích hợp (tuần 4).
     * Chặn 409 nếu lớp đã có bản DRAFT đang mở.
     *
     * @param sourceVersionId ID của phiên bản nguồn
     * @param note            Ghi chú lý do clone
     * @return DTO của bản nháp mới
     */
    ScheduleVersionDTO cloneVersion(Long sourceVersionId, String note);

    /**
     * Lấy toàn bộ phiên bản của một lớp (sắp xếp versionNumber tăng dần).
     */
    List<ScheduleVersionDTO> getVersionsByClass(String classId);

    /**
     * Lấy phiên bản đang ACTIVE của lớp.
     * Tân dùng để truy vấn StudySession cho thời khóa biểu.
     * Trả 404 nếu chưa có ACTIVE.
     */
    Optional<ScheduleVersionDTO> getActiveVersion(String classId);

    /**
     * Kiểm tra phiên bản có cho phép sửa nội dung lịch (StudySession) không.
     * isEditable = true chỉ khi status == DRAFT.
     * Danh dùng guard này trước khi thêm/sửa/hủy buổi học.
     */
    ScheduleVersionDTO getEditableStatus(Long versionId);

    /**
     * Lấy lịch sử phiên bản của lớp (sắp xếp versionNumber giảm dần).
     */
    List<ScheduleVersionDTO> getHistory(String classId);

    /**
     * Xóa một phiên bản lịch học ở trạng thái DRAFT.
     * Chặn không cho xóa nếu phiên bản đang ở trạng thái ACTIVE hoặc ARCHIVED.
     *
     * @param id ID của ScheduleVersion cần xóa
     */
    void deleteDraft(Long id);
}
