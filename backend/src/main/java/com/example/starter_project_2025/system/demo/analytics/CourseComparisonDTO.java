package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.Granularity;

import java.time.LocalDate;
import java.util.List;

/**
 * DTO cho trang <b>so sánh giữa các khóa học</b> trong Course Analytics.
 *
 * <p>Cấu trúc gồm 3 phần:
 * <ul>
 *   <li>{@link CourseComparisonItem} — một dòng cho mỗi khóa học, chứa số liệu của
 *       <b>tất cả</b> module (phễu, xu hướng, hoạt động, đánh giá, phòng ban, xếp hạng,
 *       chất lượng nội dung, giờ học) cùng thứ hạng của khóa học đó trong từng module.</li>
 *   <li>{@link ModuleInsight} — nhận định/đánh giá của từng module: khóa học tốt nhất,
 *       khóa học kém nhất và câu kết luận bằng chữ.</li>
 *   <li>{@link CourseComparisonResponse} — gói toàn bộ lại kèm khoảng thời gian đã dùng.</li>
 * </ul>
 */
public final class CourseComparisonDTO {

    private CourseComparisonDTO() {
    }

    /**
     * Số liệu của một khóa học trong toàn bộ các module so sánh.
     *
     * <p>Các trường được gom phẳng (không lồng theo module) để frontend dễ dựng
     * bảng so sánh: mỗi module chỉ cần chọn ra cột cần hiển thị.
     */
    public record CourseComparisonItem(
            Long courseId,
            String courseName,
            String instructor,

            // ===== Tổng quan (từ bảng xếp hạng) =====
            long learnerCount,
            long completedLearners,
            double completionRate,
            double notCompletedRate,
            double dropOffRate,

            // ===== 1. Phễu học tập =====
            int funnelTotalLessons,
            /** Tỉ lệ hoàn thành trung bình của các bài học trong khóa (0-100). */
            double funnelAvgCompletion,
            /** Tỉ lệ hoàn thành bài học đầu tiên (0-100). */
            double funnelFirstLessonRate,
            /** Tỉ lệ hoàn thành bài học cuối cùng (0-100). */
            double funnelLastLessonRate,
            /** Mức tụt lớn nhất giữa hai bài liền kề (%). */
            double funnelMaxDropOff,
            /** Tên bài học gây tụt nhiều nhất. */
            String funnelMaxDropOffLesson,
            /** Bài học có tỉ lệ hoàn thành thấp nhất (%). */
            double funnelLowestLessonRate,
            String funnelLowestLesson,
            /** Thứ hạng của khóa học trong module phễu (1 = tốt nhất). */
            int funnelRank,

            // ===== 2. Xu hướng theo thời gian =====
            long trendEnrollments,
            long trendLessonsCompleted,
            long trendCertificates,
            /** Số lượt đăng ký trung bình mỗi ngày trong khoảng thời gian. */
            double trendEnrollmentsPerDay,
            int trendRank,

            // ===== 3. Hoạt động & rủi ro bỏ học =====
            long activityActive,
            long activityInactive,
            long activityNeverStarted,
            /** Tỉ lệ học viên còn hoạt động (0-100). */
            double activityActiveRate,
            long activityAtRisk,
            /** Tỉ lệ học viên có nguy cơ bỏ học (0-100). */
            double activityAtRiskRate,
            double activityAverageRiskScore,
            int activityRank,

            // ===== 4. Đánh giá =====
            double reviewAverageRating,
            long reviewTotal,
            /** Tỉ lệ học viên đã đánh giá (0-100). */
            double reviewCoverage,
            /** Tỉ lệ đánh giá 5 sao (0-100). */
            double reviewFiveStarRate,
            /** Tỉ lệ đánh giá 1-2 sao (0-100). */
            double reviewLowStarRate,
            int reviewRank,

            // ===== 5. Phòng ban =====
            int departmentCount,
            String departmentBest,
            double departmentBestRate,
            String departmentWorst,
            double departmentWorstRate,
            /** Chênh lệch hoàn thành giữa phòng ban tốt nhất và kém nhất (điểm %). */
            double departmentGap,
            int departmentRank,

            // ===== 6. Xếp hạng =====
            int rankByLearners,
            int rankByCompletion,
            int rankByRating,
            int rankByDropOff,

            // ===== 7. Chất lượng nội dung & Q&A =====
            long contentTotalReports,
            long contentOpenReports,
            /** Tỉ lệ báo cáo đã được xử lý (0-100). */
            double contentResolvedRate,
            long contentTotalQuestions,
            long contentUnanswered,
            /** Tỉ lệ câu hỏi đã được trả lời (0-100). */
            double contentAnswerRate,
            /** Thời gian phản hồi trung bình (giờ), null nếu chưa có câu nào được trả lời. */
            Double contentAverageResponseHours,
            int contentRank,

            // ===== 8. Thời gian học =====
            double studyTotalHours,
            double studyAverageHours,
            /** Số giờ học của học viên học nhiều nhất trong khóa. */
            double studyMaxHours,
            int studyRank,

            // ===== Tổng hợp =====
            /** Điểm tổng hợp 0-100 (cao = khóa học hoạt động tốt hơn). */
            double overallScore,
            /** EXCELLENT | GOOD | AVERAGE | POOR */
            String overallVerdict,
            /** Các điểm mạnh nổi bật của khóa học. */
            List<String> strengths,
            /** Các điểm yếu cần cải thiện. */
            List<String> weaknesses,
            /**
             * Đánh giá riêng của khóa học này cho TỪNG module, dạng map
             * {@code moduleKey -> nhận định}. Ví dụ {@code "funnel": "..."}.
             */
            java.util.Map<String, String> moduleEvaluations
    ) {
    }

    /**
     * Nhận định của một module so sánh.
     *
     * @param bestValue    giá trị tốt nhất của module (null nếu không có dữ liệu)
     * @param worstValue   giá trị kém nhất của module (null nếu không có dữ liệu)
     * @param bestMetric   tên chỉ số được dùng để so sánh (VD: "Average lesson completion")
     * @param evaluation   câu đánh giá bằng chữ, tổng hợp kết quả của module
     */
    public record ModuleInsight(
            String key,
            String title,
            String description,
            /** Chỉ số dùng để xếp hạng trong module này. */
            String bestMetric,
            Long bestCourseId,
            String bestCourseName,
            Double bestValue,
            Long worstCourseId,
            String worstCourseName,
            Double worstValue,
            /** Câu đánh giá tổng hợp của module. */
            String evaluation
    ) {
    }

    /** Kết quả so sánh toàn bộ các khóa học. */
    public record CourseComparisonResponse(
            int totalCourses,
            LocalDate from,
            LocalDate to,
            Granularity granularity,
            int inactiveThresholdDays,
            /** Các khóa học, đã sắp xếp theo điểm tổng hợp giảm dần. */
            List<CourseComparisonItem> courses,
            /** Nhận định cho từng module. */
            List<ModuleInsight> modules
    ) {
    }
}
