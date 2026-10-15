package com.example.starter_project_2025.system.schedule_version;

/**
 * Trạng thái vòng đời của một phiên bản lịch học.
 *
 * DRAFT    → Bản nháp: đang soạn thảo, chỉ giáo vụ/admin xem được.
 *            Danh được phép thêm/sửa/hủy StudySession trong bản này.
 * ACTIVE   → Đang áp dụng chính thức: học viên và giảng viên xem thời khóa biểu từ bản này.
 *            Mỗi lớp tối đa một bản ACTIVE tại một thời điểm.
 * ARCHIVED → Lưu trữ: bản cũ đã bị thay thế khi bản mới được kích hoạt.
 *            Không được ghi thêm hoặc sửa đổi bất kỳ nội dung nào.
 */
public enum ScheduleVersionStatus {
    DRAFT,
    ACTIVE,
    ARCHIVED
}
