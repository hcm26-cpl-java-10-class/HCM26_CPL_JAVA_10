package com.example.starter_project_2025.system.schedule_version;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportEntity;
import com.example.starter_project_2025.base.dataio.exporter.annotation.ExportField;
import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.Check;

import java.time.LocalDateTime;

/**
 * Phiên bản lịch học của một lớp.
 *
 * Mỗi lớp (classId) có thể có nhiều ScheduleVersion nhưng
 * tại một thời điểm CHỈ CÓ ĐỘC NHẤT MỘT bản status = ACTIVE.
 *
 * Vòng đời: DRAFT → ACTIVE → ARCHIVED
 *
 * Ràng buộc DB:
 *  - (class_id, version_number) là duy nhất.
 *  - version_number phải > 0.
 *
 * Chủ sở hữu: Phát
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Table(
        name = "schedule_versions",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_schedule_version_class_number",
                        columnNames = {"class_id", "version_number"}
                )
        }
)
@Check(constraints = "version_number > 0")
@FieldDefaults(level = AccessLevel.PRIVATE)
@ExportEntity(fileName = "schedule_versions", sheetName = "ScheduleVersions")
@ResourcePermission("SCHEDULE_VERSION")
@ResourceMenu(
        title = "Schedule Versions",
        group = "Schedule Management",
        icon = "calendar-clock",
        url = "/schedule-versions",
        order = 3,
        permission = "SCHEDULE_VERSION_READ"
)
public class ScheduleVersion extends BaseEntity {

    /**
     * ID lớp học (tham chiếu TrainingClass từ dự án tổng / module Tú).
     * Lưu dạng String theo quy ước ID chung của nhóm (Bang_API_dung_chung v1).
     */
    @Column(name = "class_id", nullable = false, length = 64)
    @ExportField(name = "Class ID")
    String classId;

    /**
     * Số thứ tự phiên bản trong cùng một lớp. Tự động tăng khi tạo nháp/clone.
     * Luôn > 0; cặp (class_id, version_number) là duy nhất.
     */
    @Column(name = "version_number", nullable = false)
    @ExportField(name = "Version Number")
    Integer versionNumber;

    /**
     * Trạng thái vòng đời: DRAFT → ACTIVE → ARCHIVED.
     */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @ExportField(name = "Status")
    ScheduleVersionStatus status;

    /**
     * Ghi chú hoặc lý do tạo/thay đổi phiên bản.
     * Ví dụ: "Dời lịch do nghỉ lễ 20/11", "Đổi phòng học từ tuần 5".
     */
    @Column(length = 500)
    @ExportField(name = "Note")
    String note;

    /**
     * ID phiên bản nguồn nếu phiên bản này được tạo bằng cách Clone.
     * Null nếu đây là bản nháp rỗng (createDraft).
     */
    @Column(name = "cloned_from_version_id", length = 64)
    @ExportField(name = "Cloned From Version ID")
    String clonedFromVersionId;

    /**
     * Thời điểm phiên bản này được kích hoạt thành công lên ACTIVE.
     * Null khi đang là DRAFT.
     */
    @Column(name = "activated_at")
    @ExportField(name = "Activated At")
    LocalDateTime activatedAt;

    /**
     * ID (String) của người thực hiện kích hoạt phiên bản.
     * Null khi đang là DRAFT.
     * Theo quy ước Bang_API v1: ID dùng String tối đa 64 ký tự.
     */
    @Column(name = "activated_by", length = 64)
    @ExportField(name = "Activated By")
    String activatedBy;
}
