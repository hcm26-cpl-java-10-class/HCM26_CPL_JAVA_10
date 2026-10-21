package com.example.starter_project_2025.system.schedule.session.session_attendance;

/**
 * T1 — Snapshot trạng thái thành viên của học viên trong lớp tại thời điểm ghi điểm danh.
 *
 * <p>DEV 6 không sở hữu roster (UFR-PEO-010), giá trị này được lấy từ contract và lưu lại
 * để thống kê không phụ thuộc dữ liệu sống:</p>
 *
 * <ul>
 *     <li>{@link #ACTIVE} — đang học tại lớp ⇒ được ghi điểm danh</li>
 *     <li>{@link #INACTIVE} — đã nghỉ/bảo lưu ⇒ 422 {@code STUDENT_NOT_ACTIVE}</li>
 *     <li>{@link #NOT_IN_CLASS} — không thuộc lớp ⇒ 422 {@code STUDENT_NOT_IN_CLASS}</li>
 *     <li>{@link #NOT_FOUND} — không tồn tại / khác tenant ⇒ 404 {@code STUDENT_NOT_FOUND}</li>
 *     <li>{@link #UNKNOWN} — contract chưa cung cấp thông tin ⇒ bỏ qua kiểm tra (fail-open)</li>
 * </ul>
 */
public enum AttendanceMembershipStatus {
    ACTIVE,
    INACTIVE,
    NOT_IN_CLASS,
    NOT_FOUND,
    UNKNOWN;

    /** Trạng thái được phép ghi điểm danh. */
    public boolean isRecordable() {
        return this == ACTIVE || this == UNKNOWN;
    }
}
