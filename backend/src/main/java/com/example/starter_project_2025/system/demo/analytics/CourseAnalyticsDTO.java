package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.Granularity;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Các DTO (record) cho trang Course Analytics. */
public final class CourseAnalyticsDTO {

    private CourseAnalyticsDTO() {
    }

    // ===== 1. Lesson funnel =====

    public record LessonFunnelItem(
            Long lessonId,
            String lessonTitle,
            String contentType,
            Long sectionId,
            String sectionTitle,
            int sectionOrder,
            int lessonOrder,
            /** Vị trí 1..n của bài trong toàn khóa. */
            int position,
            /** Số học viên đã mở/bắt đầu bài (có bản ghi progress). */
            long startedCount,
            /** Số học viên đã hoàn thành bài. */
            long completedCount,
            /** completedCount / tổng học viên đang học (0-100). */
            double completionRate,
            /** Điểm % tụt so với bài liền trước (>= 0). Bài đầu tiên = 0. */
            double dropOffFromPrevious
    ) {
    }

    public record LessonFunnelResponse(
            Long courseId,
            String courseName,
            long totalLearners,
            int totalLessons,
            /** Bài có mức tụt lớn nhất so với bài trước (null nếu không có dữ liệu). */
            LessonFunnelItem biggestDropOff,
            /** Bài có tỉ lệ hoàn thành thấp nhất (null nếu không có bài). */
            LessonFunnelItem lowestCompletion,
            List<LessonFunnelItem> lessons
    ) {
    }

    // ===== 2. Trend =====

    public enum Granularity { DAY, WEEK, MONTH }

    public record TrendPoint(
            /** Ngày bắt đầu của bucket (ngày / thứ Hai của tuần / mùng 1 của tháng). */
            LocalDate bucketStart,
            long enrollments,
            long lessonsCompleted,
            long certificatesIssued
    ) {
    }

    public record TrendResponse(
            Long courseId,
            String courseName,
            LocalDate from,
            LocalDate to,
            Granularity granularity,
            long totalEnrollments,
            long totalLessonsCompleted,
            long totalCertificatesIssued,
            List<TrendPoint> points
    ) {
    }

    // ===== 3. Activity / at-risk =====

    public record ProgressBucket(String label, long learners) {
    }

    /** Một yếu tố làm tăng điểm rủi ro bỏ học. */
    public record RiskFactor(
            /** Mã yếu tố: INACTIVITY | LOW_PROGRESS | NEVER_STARTED | LOW_EXAM_SCORE | LOW_STUDY_TIME. */
            String code,
            /** Nhãn tiếng Anh để hiển thị. */
            String label,
            /** Số điểm yếu tố này góp vào tổng điểm rủi ro. */
            int points,
            /** Mô tả chi tiết (tiếng Anh). */
            String detail
    ) {
    }

    /**
     * Học viên có nguy cơ bỏ học.
     *
     * <p>Học viên đã hoàn thành khóa học không bao giờ nằm trong nhóm nguy cơ.
     */
    public record AtRiskLearner(
            Long enrollmentId,
            Long userId,
            String studentName,
            String studentEmail,
            /** Phòng ban của học viên (null nếu chưa được gán). */
            String departmentName,
            int progressPercentage,
            LocalDateTime enrolledAt,
            /** Lần truy cập gần nhất; null nếu chưa từng vào học. */
            LocalDateTime lastAccessedAt,
            /** Số ngày không hoạt động (tính từ lastAccessedAt, hoặc từ ngày đăng ký nếu chưa vào học). */
            long inactiveDays,
            /** NEVER_STARTED | INACTIVE */
            String reason,
            /** HIGH | MEDIUM | LOW */
            String riskLevel,
            /** Điểm rủi ro 0-100. */
            int riskScore,
            /** Các yếu tố đã góp điểm, sắp xếp theo điểm giảm dần. */
            List<RiskFactor> riskFactors,
            /** Yếu tố chính (mã yếu tố điểm cao nhất). */
            String primaryRiskReason,
            /** Tổng giây đã học trong khóa học. */
            long studySeconds,
            /** Điểm thi trung bình (% điểm tối đa), null nếu chưa thi. */
            Double examScorePercent
    ) {
    }

    public record ActivityResponse(
            Long courseId,
            String courseName,
            int inactiveThresholdDays,
            long totalLearners,
            long completedLearners,
            /** Đã vào học trong vòng N ngày gần nhất và chưa hoàn thành. */
            long activeLearners,
            /** Chưa hoàn thành và không vào học >= N ngày (đã từng vào học). */
            long inactiveLearners,
            /** Chưa từng vào học / chưa hoàn thành bài nào. */
            long neverStartedLearners,
            /** Số học viên chưa hoàn thành (không tính vào nhóm nguy cơ). */
            long notCompletedLearners,
            /** Số học viên có nguy cơ bỏ học (HIGH + MEDIUM). */
            long atRiskCount,
            /** Số học viên rủi ro cao. */
            long highRiskCount,
            /** Số học viên rủi ro trung bình. */
            long mediumRiskCount,
            /** Số học viên rủi ro thấp. */
            long lowRiskCount,
            /** Điểm rủi ro trung bình (0-100) trong nhóm nguy cơ. */
            double averageRiskScore,
            List<ProgressBucket> progressDistribution,
            /** Phân bố mức rủi ro (HIGH / MEDIUM / LOW). */
            List<RiskLevelBucket> riskDistribution,
            List<AtRiskLearner> atRiskLearners
    ) {
    }

    /** Nhóm học viên theo mức rủi ro. */
    public record RiskLevelBucket(String level, long learners) {
    }

    // ===== 4. Reviews =====

    public record RatingBucket(int stars, long count, double percentage) {
    }

    public record CourseReviewAnalyticsResponse(
            Long courseId,
            String courseName,
            double averageRating,
            long totalReviews,
            long totalLearners,
            /** Số review / số học viên (0-100). */
            double reviewCoverage,
            /** Luôn đủ 5 mức sao, từ 5 xuống 1. */
            List<RatingBucket> distribution
    ) {
    }

    public record CourseRatingRankItem(
            int rank,
            Long courseId,
            String courseName,
            String instructor,
            double averageRating,
            long totalReviews
    ) {
    }

    // ===== 5. Exams =====

    public record ScoreBucket(String label, long attempts) {
    }

    public record ExamAnalyticsItem(
            Long examId,
            String title,
            String category,
            BigDecimal maxScore,
            BigDecimal passScore,
            /** Tổng lượt làm (mọi trạng thái). */
            long totalAttempts,
            /** Lượt đã chấm xong (SUBMITTED/EXPIRED có điểm) - cơ sở tính điểm. */
            long gradedAttempts,
            long participants,
            Double averageScore,
            Double highestScore,
            Double lowestScore,
            long passedAttempts,
            /** passedAttempts / gradedAttempts (0-100), null nếu chưa có lượt chấm xong. */
            Double passRate,
            /** Phân bố điểm theo % điểm tối đa: 0-20, 20-40, 40-60, 60-80, 80-100. */
            List<ScoreBucket> scoreDistribution
    ) {
    }

    public record CourseExamAnalyticsResponse(
            Long courseId,
            String courseName,
            int totalExams,
            long totalGradedAttempts,
            Double overallAverageScorePercent,
            Double overallPassRate,
            List<ExamAnalyticsItem> exams
    ) {
    }

    // ===== 6. Department analytics =====

    /**
     * Số liệu hiệu quả đào tạo của một phòng ban.
     *
     * @param learnerCount       số lượt đăng ký (học viên) của phòng ban
     * @param completedLearners  số học viên đã hoàn thành khóa học
     * @param completionRate     tỉ lệ hoàn thành (0-100)
     * @param averageProgress    điểm tiến độ trung bình (0-100)
     * @param averageExamScore   điểm thi trung bình (% điểm tối đa), null khi chưa có lượt thi nào
     * @param activeLearners     học viên còn hoạt động (chưa hoàn thành + truy cập gần đây)
     * @param neverStartedLearners học viên chưa từng mở bài học nào
     * @param atRiskLearners     học viên có nguy cơ bỏ học (chưa hoàn thành + rủi ro HIGH/MEDIUM)
     * @param notCompletedRate   tỉ lệ chưa hoàn thành (0-100) = 100 - completionRate
     * @param dropOffRate        tỉ lệ bỏ học thực sự (0-100): chưa hoàn thành VÀ không hoạt động
     */
    public record DepartmentAnalyticsItem(
            Long departmentId,
            String departmentCode,
            String departmentName,
            long learnerCount,
            long completedLearners,
            double completionRate,
            double averageProgress,
            Double averageExamScore,
            long examGradedAttempts,
            long activeLearners,
            long neverStartedLearners,
            long atRiskLearners,
            /** Tỉ lệ chưa hoàn thành (0-100) = 100 - completionRate. */
            double notCompletedRate,
            /** Tỉ lệ bỏ học thực sự (0-100). */
            double dropOffRate,
            /** Tổng số giây học của phòng ban. */
            long totalStudySeconds,
            /** Tổng số giờ học của phòng ban. */
            double totalStudyHours,
            /** Số giờ học trung bình mỗi học viên của phòng ban. */
            double averageStudyHoursPerLearner
    ) {
    }

    public record DepartmentAnalyticsResponse(
            /** null khi xem toàn hệ thống. */
            Long courseId,
            String courseName,
            long totalLearners,
            int departmentCount,
            /** Tổng số giờ học của toàn bộ phòng ban trong phạm vi. */
            double totalStudyHours,
            /** Phòng ban có hiệu quả đào tạo tốt nhất. */
            DepartmentAnalyticsItem bestDepartment,
            /** Phòng ban có hiệu quả đào tạo kém nhất. */
            DepartmentAnalyticsItem worstDepartment,
            List<DepartmentAnalyticsItem> departments
    ) {
    }

    // ===== 7. Course ranking =====

    public record CourseRankingItem(
            int rank,
            Long courseId,
            String courseName,
            String instructor,
            long learnerCount,
            long completedLearners,
            double completionRate,
            double averageRating,
            long totalReviews,
            /** Học viên đã truy cập khóa học trong vòng ngưỡng không hoạt động. */
            long activeLearners,
            /** Học viên đã từng học nhưng đã lâu không truy cập. */
            long inactiveLearners,
            /** Học viên chưa từng mở bài học nào. */
            long neverStartedLearners,
            /** Số học viên chưa hoàn thành khóa học. */
            long notCompletedLearners,
            /** Tỉ lệ chưa hoàn thành (0-100) = học viên chưa hoàn thành / tổng học viên. */
            double notCompletedRate,
            /**
             * Tỉ lệ bỏ học thực sự (0-100): số học viên đã bỏ học (inactive + never started,
             * chưa hoàn thành) chia cho tổng số học viên.
             */
            double dropOffRate
    ) {
    }

    public record CourseRankingResponse(
            int totalCourses,
            List<CourseRankingItem> topByLearners,
            List<CourseRankingItem> topByCompletionRate,
            List<CourseRankingItem> topByRating,
            List<CourseRankingItem> highestDropOff,
            List<CourseRankingItem> allCourses
    ) {
    }

    // ===== 8. Content quality + Q&A =====

    public record ReportedLessonItem(
            int rank,
            Long lessonId,
            String lessonTitle,
            Long courseId,
            String courseName,
            long reportCount,
            long openReports,
            long resolvedReports,
            /** Lý do báo cáo phổ biến nhất của bài học này. */
            String topReason
    ) {
    }

    public record ReportReasonBucket(String reason, long count, double percentage) {
    }

    public record UnansweredQuestionItem(
            Long questionId,
            Long lessonId,
            String lessonTitle,
            String courseName,
            String studentName,
            String content,
            LocalDateTime createdAt,
            /** Số giờ đã chờ kể từ khi hỏi. */
            long waitingHours
    ) {
    }

    public record ContentQualityResponse(
            Long courseId,
            String courseName,
            long totalReports,
            long openReports,
            long resolvedReports,
            long totalQuestions,
            long answeredQuestions,
            /** Số câu hỏi chưa được trả lời. */
            long unansweredCount,
            /** Tỉ lệ đã trả lời (0-100). */
            double answerRate,
            /** Thời gian phản hồi trung bình (giờ), null khi chưa có câu nào được trả lời. */
            Double averageResponseHours,
            List<ReportedLessonItem> mostReportedLessons,
            List<ReportReasonBucket> reportReasons,
            List<UnansweredQuestionItem> unansweredQuestions
    ) {
    }

    // ===== 9. Thời gian học (study time) =====

    /**
     * Thời gian học của một học viên trong một khóa học.
     *
     * @param studySeconds     tổng số giây học viên đã dành cho các bài của khóa học
     * @param studyHours       {@code studySeconds / 3600} (làm tròn 2 chữ số)
     * @param completedLessons số bài đã hoàn thành
     * @param totalLessons     tổng số bài của khóa học
     * @param completionRate   tỉ lệ hoàn thành (0-100)
     */
    public record StudentStudyTimeItem(
            Long enrollmentId,
            Long userId,
            String studentName,
            String studentEmail,
            /** Phòng ban chính của học viên (null nếu chưa được gán). */
            String departmentName,
            long studySeconds,
            double studyHours,
            int completedLessons,
            int totalLessons,
            double completionRate,
            LocalDateTime lastAccessedAt
    ) {
    }

    public record StudyTimeResponse(
            Long courseId,
            String courseName,
            /** Tổng số giây học của cả khóa học. */
            long totalStudySeconds,
            /** Tổng số giờ học của cả khóa học. */
            double totalStudyHours,
            int totalLearners,
            /** Số giờ học trung bình mỗi học viên. */
            double averageStudyHoursPerLearner,
            /** Học viên học nhiều nhất trong khóa học. */
            StudentStudyTimeItem topLearner,
            /** Danh sách học viên, sắp xếp giảm dần theo số giờ học. */
            List<StudentStudyTimeItem> learners
    ) {
    }
}
