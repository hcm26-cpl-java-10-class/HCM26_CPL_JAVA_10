package com.example.starter_project_2025.system.demo.report;

/**
 * Số liệu tổng hợp của "Learning hours analytics".
 *
 * @param totalHours        tổng số giờ học của toàn bộ hệ thống
 * @param totalEnrollments  tổng số lượt đăng ký
 * @param studentCount      số học viên có mặt trong báo cáo
 * @param courseCount       số khóa học có mặt trong báo cáo
 * @param departmentCount   số phòng ban có mặt trong báo cáo
 * @param averageHoursPerStudent giờ học trung bình mỗi học viên
 * @param averageHoursPerCourse  giờ học trung bình mỗi khóa học
 */
public record LearningHoursTotalsDTO(
        double totalHours,
        long totalEnrollments,
        long studentCount,
        long courseCount,
        long departmentCount,
        double averageHoursPerStudent,
        double averageHoursPerCourse
) {
}
