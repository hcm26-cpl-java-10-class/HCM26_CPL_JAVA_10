package com.example.starter_project_2025.system.demo.report;

/**
 * Một nhóm tổng hợp giờ học (theo phòng ban / khóa học / học viên).
 *
 * @param id             mã nhóm (departmentId / courseId / userId)
 * @param name           tên hiển thị
 * @param code           mã phòng ban (null nếu không phải phòng ban)
 * @param totalHours     tổng giờ học của nhóm
 * @param learnerCount   số HỌC VIÊN duy nhất trong nhóm (không phải số lượt đăng ký)
 * @param enrollmentCount số lượt đăng ký trong nhóm
 * @param averageHours   giờ học trung bình mỗi học viên
 * @param courseCount    số khóa học mà học viên đã đăng ký (chỉ dùng cho nhóm học viên)
 */
public record LearningHoursGroupDTO(
        Long id,
        String name,
        String code,
        double totalHours,
        long learnerCount,
        long enrollmentCount,
        double averageHours,
        Long courseCount
) {
    /** Nhóm không có khóa học (phòng ban / khóa học). */
    public LearningHoursGroupDTO(
            Long id,
            String name,
            String code,
            double totalHours,
            long learnerCount,
            long enrollmentCount,
            double averageHours
    ) {
        this(id, name, code, totalHours, learnerCount, enrollmentCount, averageHours, null);
    }
}
