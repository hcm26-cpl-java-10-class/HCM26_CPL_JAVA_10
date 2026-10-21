package com.example.starter_project_2025.system.schedule.session.session_attendance;

import java.time.LocalDate;
import java.util.Optional;

/**
 * T1 — Cổng đọc dữ liệu từ contract bên ngoài bounded context (DEV 6 không sở hữu).
 *
 * <ul>
 *     <li>{@code loadClass} — trạng thái lớp (BR-UNI-08, {@code CLASS_NOT_ONGOING}) và suy ra
 *         trạng thái LOCKED khi lớp COMPLETED (BR-ATT-03).</li>
 *     <li>{@code loadMembership} — roster {@code (classId, studentId)} tại ngày học
 *         (UFR-PEO-010) để kiểm {@code STUDENT_NOT_IN_CLASS}/{@code STUDENT_NOT_ACTIVE}.</li>
 *     <li>{@code resolveStudentIdForActor} — ánh xạ tài khoản đăng nhập ⇒ studentId để
 *         trainee chỉ đọc được bản ghi của mình (SCR-70).</li>
 * </ul>
 *
 * <p>Mỗi kết quả đều có cờ {@code available}: khi contract không sẵn sàng, service hoặc bỏ qua
 * kiểm tra (mặc định, fail-open) hoặc trả 503 {@code CONTRACT_UNAVAILABLE} nếu bật strict mode.
 * Cách này cho phép thay thế implementation bằng adapter thật mà không đổi nghiệp vụ.</p>
 */
public interface AttendanceContractGateway {

    ClassSnapshot loadClass(Long classId);

    MembershipSnapshot loadMembership(Long classId, Long studentId, LocalDate attendanceDate);

    Optional<Long> resolveStudentIdForActor(Long actorUserId);

    record ClassSnapshot(boolean available, String status) {

        public static ClassSnapshot available(String status) {
            return new ClassSnapshot(true, status);
        }

        public static ClassSnapshot unavailable() {
            return new ClassSnapshot(false, null);
        }
    }

    record MembershipSnapshot(boolean available, AttendanceMembershipStatus status) {

        public static MembershipSnapshot of(AttendanceMembershipStatus status) {
            return new MembershipSnapshot(true, status);
        }

        public static MembershipSnapshot unknown() {
            return new MembershipSnapshot(false, AttendanceMembershipStatus.UNKNOWN);
        }
    }
}
