package com.example.starter_project_2025.system.demo.certificate.insights;

import java.time.LocalDate;
import java.util.List;

public final class CertificateInsightsDTO {

    private CertificateInsightsDTO() {
    }

    public record Overview(
            long totalCertificates,
            long uniqueLearners,
            long uniqueCourses,
            long departmentsWithCertificates,
            double averageCertificatesPerLearner
    ) {}

    // Giữ lại để tương thích với service hoặc AI Advisor cũ nếu còn sử dụng.
    public record SkillCoverage(
            Long categoryId,
            String skillCode,
            String skillName,
            long certificateCount,
            long uniqueLearners,
            double percentage
    ) {}

    public record SkillItem(
            Long categoryId,
            String skillCode,
            String skillName
    ) {}

    public record DepartmentItem(
            Long departmentId,
            String departmentName,
            long totalEmployees
    ) {}

    /**
     * Chỉ tồn tại khi phòng ban có ít nhất một nhân viên
     * sở hữu chứng chỉ thuộc nhóm kỹ năng.
     */
    public record DepartmentSkillCoverage(
            Long departmentId,
            String departmentName,
            long totalEmployees,
            Long categoryId,
            String skillCode,
            String skillName,
            long certifiedEmployees,
            long certificateCount,
            double coveragePercentage
    ) {}

    public record HeatmapResponse(
            List<SkillItem> skills,
            List<DepartmentItem> departments,
            List<DepartmentSkillCoverage> cells
    ) {}

    public record CourseBreakdown(
            Long courseId,
            String courseName,
            long certificateCount,
            long certifiedLearners
    ) {}

    public record CertifiedLearner(
            Long userId,
            String fullName,
            String email,
            long certificateCount,
            LocalDate latestIssuedAt
    ) {}

    public record CellDetailResponse(
            DepartmentSkillCoverage summary,
            List<CourseBreakdown> courses,
            List<CertifiedLearner> learners
    ) {}
}
