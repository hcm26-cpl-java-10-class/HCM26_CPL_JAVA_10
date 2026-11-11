package com.example.starter_project_2025.system.demo.aicomparison;

import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.CourseComparisonItem;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Danh mục chỉ số dùng cho phân tích so sánh bằng AI.
 *
 * <p>Đây là nơi duy nhất định nghĩa:
 * <ul>
 *   <li>những field nào được đưa vào payload gửi cho AI,</li>
 *   <li>chiều của chỉ số (cao hơn là tốt hay thấp hơn là tốt),</li>
 *   <li>chỉ số chính của từng module (dùng để quyết định vị trí ABOVE/AT_PAR/BELOW).</li>
 * </ul>
 *
 * <p>Chiều "thấp hơn là tốt" được copy từ {@code higherIsBetter} của
 * {@code comparison-config.ts} ở frontend để BE và FE không lệch nhau.
 */
final class CourseAiComparisonMetrics {

    /** 8 module của trang so sánh, đúng thứ tự hiển thị. */
    static final List<String> MODULE_KEYS = List.of(
            "funnel", "trend", "activity", "reviews", "departments", "ranking", "content", "study-time");

    /**
     * Một chỉ số: tên field, chiều đánh giá, và module nó thuộc về.
     *
     * @param higherIsBetter {@code true} nếu giá trị càng CAO càng tốt.
     */
    record Metric(String key, boolean higherIsBetter, String moduleKey) {
    }

    /** Toàn bộ chỉ số được phân tích (dùng cho peerStats). */
    static final List<Metric> METRICS = List.of(
            // ===== Tổng quan =====
            new Metric("overallScore", true, "ranking"),
            new Metric("learnerCount", true, "ranking"),
            new Metric("completionRate", true, "ranking"),
            new Metric("dropOffRate", false, "ranking"),

            // ===== 1. Phễu học tập =====
            new Metric("funnelAvgCompletion", true, "funnel"),
            new Metric("funnelFirstLessonRate", true, "funnel"),
            new Metric("funnelLastLessonRate", true, "funnel"),
            new Metric("funnelMaxDropOff", false, "funnel"),
            new Metric("funnelLowestLessonRate", true, "funnel"),
            new Metric("funnelTotalLessons", true, "funnel"),

            // ===== 2. Xu hướng =====
            new Metric("trendEnrollments", true, "trend"),
            new Metric("trendEnrollmentsPerDay", true, "trend"),
            new Metric("trendLessonsCompleted", true, "trend"),
            new Metric("trendCertificates", true, "trend"),

            // ===== 3. Hoạt động & rủi ro =====
            new Metric("activityActiveRate", true, "activity"),
            new Metric("activityAtRiskRate", false, "activity"),
            new Metric("activityAverageRiskScore", false, "activity"),

            // ===== 4. Đánh giá =====
            new Metric("reviewAverageRating", true, "reviews"),
            new Metric("reviewCoverage", true, "reviews"),
            new Metric("reviewFiveStarRate", true, "reviews"),
            new Metric("reviewLowStarRate", false, "reviews"),

            // ===== 5. Phòng ban =====
            new Metric("departmentGap", false, "departments"),
            new Metric("departmentBestRate", true, "departments"),
            new Metric("departmentWorstRate", true, "departments"),

            // ===== 6. Chất lượng nội dung & Q&A =====
            new Metric("contentAnswerRate", true, "content"),
            new Metric("contentResolvedRate", true, "content"),
            new Metric("contentOpenReports", false, "content"),
            new Metric("contentUnanswered", false, "content"),
            new Metric("contentAverageResponseHours", false, "content"),

            // ===== 7. Thời gian học =====
            new Metric("studyAverageHours", true, "study-time"),
            new Metric("studyTotalHours", true, "study-time")
    );

    /**
     * Các chỉ số chính của từng module — dùng để tính vị trí
     * ABOVE / AT_PAR / BELOW của khóa học mục tiêu.
     */
    static final Map<String, List<String>> MODULE_MAIN_METRICS = Map.of(
            "funnel", List.of("funnelAvgCompletion", "funnelMaxDropOff", "funnelLowestLessonRate"),
            "trend", List.of("trendEnrollmentsPerDay", "trendLessonsCompleted"),
            "activity", List.of("activityActiveRate", "activityAtRiskRate", "activityAverageRiskScore"),
            "reviews", List.of("reviewAverageRating", "reviewCoverage", "reviewLowStarRate"),
            "departments", List.of("departmentGap", "departmentBestRate"),
            "ranking", List.of("overallScore", "completionRate", "dropOffRate"),
            "content", List.of("contentAnswerRate", "contentResolvedRate", "contentOpenReports", "contentAverageResponseHours"),
            "study-time", List.of("studyAverageHours")
    );

    private static final Map<String, Metric> BY_KEY = METRICS.stream()
            .collect(java.util.stream.Collectors.toMap(Metric::key, m -> m, (a, b) -> a, LinkedHashMap::new));

    private CourseAiComparisonMetrics() {
    }

    static Metric metric(String key) {
        return BY_KEY.get(key);
    }

    static boolean isKnown(String key) {
        return BY_KEY.containsKey(key);
    }

    /**
     * Payload của MỘT khóa học gửi cho AI: các field cần thiết, tên field khớp DTO thật.
     * Bỏ qua {@code strengths / weaknesses / moduleEvaluations} (rule-based) để
     * AI phân tích độc lập.
     */
    static Map<String, Object> payload(CourseComparisonItem item) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("courseId", item.courseId());
        map.put("courseName", item.courseName());
        map.put("instructor", item.instructor());
        map.put("learnerCount", item.learnerCount());
        map.put("completionRate", item.completionRate());
        map.put("dropOffRate", item.dropOffRate());

        map.put("funnelTotalLessons", item.funnelTotalLessons());
        map.put("funnelAvgCompletion", item.funnelAvgCompletion());
        map.put("funnelMaxDropOff", item.funnelMaxDropOff());
        map.put("funnelMaxDropOffLesson", item.funnelMaxDropOffLesson());
        map.put("funnelLowestLesson", item.funnelLowestLesson());
        map.put("funnelLowestLessonRate", item.funnelLowestLessonRate());

        map.put("trendEnrollments", item.trendEnrollments());
        map.put("trendEnrollmentsPerDay", item.trendEnrollmentsPerDay());

        map.put("activityActiveRate", item.activityActiveRate());
        map.put("activityAtRiskRate", item.activityAtRiskRate());
        map.put("activityAverageRiskScore", item.activityAverageRiskScore());

        map.put("reviewAverageRating", item.reviewAverageRating());
        map.put("reviewCoverage", item.reviewCoverage());
        map.put("reviewFiveStarRate", item.reviewFiveStarRate());
        map.put("reviewLowStarRate", item.reviewLowStarRate());

        map.put("departmentBest", item.departmentBest());
        map.put("departmentWorst", item.departmentWorst());
        map.put("departmentGap", item.departmentGap());

        map.put("contentOpenReports", item.contentOpenReports());
        map.put("contentResolvedRate", item.contentResolvedRate());
        map.put("contentUnanswered", item.contentUnanswered());
        map.put("contentAnswerRate", item.contentAnswerRate());
        map.put("contentAverageResponseHours", item.contentAverageResponseHours());

        map.put("studyAverageHours", item.studyAverageHours());

        map.put("overallScore", item.overallScore());
        map.put("overallVerdict", item.overallVerdict());
        return map;
    }

    /** Giá trị số của một chỉ số của một khóa học; {@code null} khi không có dữ liệu. */
    static Double value(CourseComparisonItem item, String key) {
        return switch (key) {
            case "overallScore" -> item.overallScore();
            case "learnerCount" -> (double) item.learnerCount();
            case "completionRate" -> item.completionRate();
            case "dropOffRate" -> item.dropOffRate();
            case "funnelTotalLessons" -> (double) item.funnelTotalLessons();
            case "funnelAvgCompletion" -> item.funnelAvgCompletion();
            case "funnelFirstLessonRate" -> item.funnelFirstLessonRate();
            case "funnelLastLessonRate" -> item.funnelLastLessonRate();
            case "funnelMaxDropOff" -> item.funnelMaxDropOff();
            case "funnelLowestLessonRate" -> item.funnelLowestLessonRate();
            case "trendEnrollments" -> (double) item.trendEnrollments();
            case "trendEnrollmentsPerDay" -> item.trendEnrollmentsPerDay();
            case "trendLessonsCompleted" -> (double) item.trendLessonsCompleted();
            case "trendCertificates" -> (double) item.trendCertificates();
            case "activityActiveRate" -> item.activityActiveRate();
            case "activityAtRiskRate" -> item.activityAtRiskRate();
            case "activityAverageRiskScore" -> item.activityAverageRiskScore();
            case "reviewAverageRating" -> item.reviewAverageRating();
            case "reviewCoverage" -> item.reviewCoverage();
            case "reviewFiveStarRate" -> item.reviewFiveStarRate();
            case "reviewLowStarRate" -> item.reviewLowStarRate();
            case "departmentGap" -> item.departmentGap();
            case "departmentBestRate" -> item.departmentBestRate();
            case "departmentWorstRate" -> item.departmentWorstRate();
            case "contentAnswerRate" -> item.contentAnswerRate();
            case "contentResolvedRate" -> item.contentResolvedRate();
            case "contentOpenReports" -> (double) item.contentOpenReports();
            case "contentUnanswered" -> (double) item.contentUnanswered();
            case "contentAverageResponseHours" -> item.contentAverageResponseHours();
            case "studyAverageHours" -> item.studyAverageHours();
            case "studyTotalHours" -> item.studyTotalHours();
            default -> null;
        };
    }
}
