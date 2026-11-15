package com.example.starter_project_2025.system.demo.report;

import java.time.LocalDateTime;

/**
 * Một dòng của bảng "Learning hours analytics".
 *
 * <p>Mỗi dòng tương ứng với một lượt đăng ký (enrollment) của một học viên
 * vào một khóa học, kèm số giờ học ở 4 cấp:
 * <ul>
 *   <li>{@code enrollmentHours} - giờ học của học viên trong riêng khóa học này</li>
 *   <li>{@code studentHours} - tổng giờ học của học viên trên tất cả khóa đã đăng ký</li>
 *   <li>{@code departmentHours} - tổng giờ học của cả phòng ban</li>
 *   <li>{@code courseHours} - tổng giờ học của cả khóa học</li>
 * </ul>
 */
public record LearningHoursRowDTO(
        Long enrollmentId,
        Long userId,
        String studentName,
        String studentEmail,
        String departmentName,
        Long courseId,
        String courseName,
        /** Ngày đăng ký khóa học - dùng để đối chiếu với thời gian học. */
        LocalDateTime enrolledAt,
        /** Lần truy cập gần nhất. */
        LocalDateTime lastAccessedAt,
        /** Số bài đã hoàn thành trong khóa học này. */
        int completedLessons,
        int totalLessons,
        /** Tỉ lệ hoàn thành (0-100). */
        double completionRate,
        /** Giờ học của riêng khóa học này. */
        double enrollmentHours,
        /** Tổng giờ học của học viên trên tất cả khóa đã đăng ký. */
        double studentHours,
        /** Tổng giờ học của phòng ban. */
        double departmentHours,
        /** Tổng giờ học của khóa học. */
        double courseHours,
        /** Số ngày kể từ ngày đăng ký đến hiện tại. */
        long daysSinceEnrollment
) {
}
