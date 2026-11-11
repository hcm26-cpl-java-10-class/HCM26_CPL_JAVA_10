package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.dto.BaseDTO;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import lombok.experimental.FieldDefaults;

import java.time.LocalDateTime;

/**
 * DTO dùng cho cả request và response của ScheduleVersion.
 *
 * Request (tạo nháp / clone):       note (tùy chọn)
 * Request (kích hoạt):               note đóng vai trò activationReason
 * Response (trả về cho frontend):    toàn bộ các trường bên dưới
 *
 * Theo Bang_API_dung_chung v1:
 *   - id và classId dùng String (tối đa 64 ký tự)
 *   - versionNumber dùng Integer
 *   - activatedAt dùng LocalDateTime
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class ScheduleVersionDTO extends BaseDTO {

    /**
     * ID lớp học. Bắt buộc khi tạo mới.
     */
    @NotBlank(groups = OnCreate.class, message = "Class ID is required")
    @Size(max = 64, message = "Class ID must not exceed 64 characters")
    String classId;

    /**
     * Số thứ tự phiên bản. Server tự sinh, client không cần gửi.
     */
    Integer versionNumber;

    /**
     * Trạng thái hiện tại: DRAFT / ACTIVE / ARCHIVED.
     */
    ScheduleVersionStatus status;

    /**
     * Ghi chú hoặc lý do thay đổi phiên bản (ví dụ: "Đổi lịch do nghỉ Tết").
     */
    @Size(max = 500, message = "Note must not exceed 500 characters")
    String note;

    /**
     * ID phiên bản gốc nếu phiên bản này được tạo bằng Clone.
     * Response only. Null nếu là bản nháp rỗng.
     */
    String clonedFromVersionId;

    /**
     * Tổng số buổi học thuộc phiên bản này.
     * Response only. Dùng cho frontend hiển thị preview.
     */
    Integer totalSessions;

    /**
     * Thời điểm kích hoạt thành công. Null khi là DRAFT.
     */
    LocalDateTime activatedAt;

    /**
     * ID người kích hoạt phiên bản. Null khi là DRAFT.
     */
    String activatedBy;

    /**
     * ID phiên bản active trước đó vừa bị Archive.
     * Response only. Chỉ có giá trị sau khi gọi /activate thành công.
     */
    String previousActiveVersionId;

    /**
     * Flag dùng cho endpoint /editable: phiên bản có cho phép sửa buổi học không?
     * Chỉ true khi status == DRAFT.
     */
    Boolean isEditable;

    /**
     * Thông báo mô tả lý do isEditable=true/false.
     */
    String editableMessage;
}
