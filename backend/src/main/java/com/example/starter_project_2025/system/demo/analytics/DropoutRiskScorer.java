package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.RiskFactor;

import java.util.ArrayList;
import java.util.List;

/**
 * Tính điểm rủi ro bỏ học (0-100) cho một học viên dựa trên nhiều yếu tố:
 * thời gian không hoạt động, tiến độ học, tỉ lệ chưa bắt đầu, điểm thi và
 * thời gian học thực tế.
 *
 * <p>Điểm càng cao càng có nguy cơ. Học viên đã hoàn thành khóa học luôn có
 * điểm 0 và bị loại khỏi nhóm nguy cơ.
 */
public final class DropoutRiskScorer {

    /** Ngưỡng mặc định (ngày) coi là không hoạt động. */
    public static final int DEFAULT_INACTIVE_DAYS = 14;

    /** Điểm tối đa của từng yếu tố. */
    private static final int MAX_INACTIVITY_POINTS = 40;
    private static final int MAX_PROGRESS_POINTS = 25;
    private static final int MAX_NEVER_STARTED_POINTS = 15;
    private static final int MAX_EXAM_POINTS = 15;
    private static final int MAX_STUDY_TIME_POINTS = 10;

    private DropoutRiskScorer() {
    }

    /** Các yếu tố đầu vào của một học viên. */
    public record Input(
            /** Tiến độ hoàn thành khóa học (0-100). */
            double progressPercentage,
            /** Số ngày không hoạt động. */
            long idleDays,
            /** Ngưỡng không hoạt động đang dùng (ngày). */
            int inactiveThresholdDays,
            /** Điểm thi trung bình (% điểm tối đa), null nếu chưa thi. */
            Double examScorePercent,
            /** Tổng giây đã học. */
            long studySeconds,
            /** Số giây học "kỳ vọng" ứng với tiến độ hiện tại. */
            long expectedStudySeconds,
            /** Học viên đã hoàn thành khóa học chưa. */
            boolean completed,
            /** Học viên chưa từng mở bài học nào. */
            boolean neverStarted
    ) {
    }

    /** Kết quả chấm điểm rủi ro. */    public record Result(
            /** Điểm rủi ro 0-100. */
            int score,
            /** HIGH | MEDIUM | LOW | COMPLETED. */
            String level,
            /** Danh sách yếu tố đã góp điểm, sắp xếp theo điểm giảm dần. */
            List<RiskFactor> factors,
            /** Lý do chính (yếu tố điểm cao nhất). */
            String primaryReason
    ) {
    }

    /**
     * Chấm điểm rủi ro cho một học viên.
     */
    public static Result score(Input input) {
        List<RiskFactor> factors = new ArrayList<>();

        if (input.completed()) {
            return new Result(0, "COMPLETED", List.of(), "COMPLETED");
        }

        // Người học chỉ bị coi là "có vấn đề" về tiến độ / chưa bắt đầu sau khi đã qua ngưỡng
        // không hoạt động. Học viên vừa đăng ký hoặc đang học đều đặn không bị gắn cờ chỉ vì
        // tiến độ còn thấp.
        int safeThreshold = input.inactiveThresholdDays() <= 0
                ? DEFAULT_INACTIVE_DAYS : input.inactiveThresholdDays();
        boolean pastGracePeriod = input.idleDays() >= safeThreshold;

        // 1. Thời gian không hoạt động (tối đa 40 điểm).
        int inactivityPoints = inactivityPoints(input.idleDays(), input.inactiveThresholdDays());
        if (inactivityPoints > 0) {
            factors.add(new RiskFactor(
                    "INACTIVITY",
                    "Long period of inactivity",
                    inactivityPoints,
                    "No access for " + input.idleDays() + " days (threshold "
                            + input.inactiveThresholdDays() + " days)"));
        }

        // 2. Tiến độ thấp (tối đa 25 điểm) - chỉ tính khi đã qua ngưỡng không hoạt động.
        double progress = Math.max(0, Math.min(100, input.progressPercentage()));
        int progressPoints = (int) Math.round((100 - progress) / 100.0 * MAX_PROGRESS_POINTS);
        if (pastGracePeriod && progressPoints > 0) {
            factors.add(new RiskFactor(
                    "LOW_PROGRESS",
                    "Low progress",
                    progressPoints,
                    "Only " + Math.round(progress) + "% of the course completed"));
        }

        // 3. Chưa từng bắt đầu (tối đa 15 điểm) - chỉ tính khi đã qua ngưỡng không hoạt động.
        if (pastGracePeriod && input.neverStarted()) {
            factors.add(new RiskFactor(
                    "NEVER_STARTED",
                    "Never started",
                    MAX_NEVER_STARTED_POINTS,
                    "The learner has not opened any lesson"));
        }

        // 4. Điểm thi thấp hoặc trượt (tối đa 15 điểm).
        if (input.examScorePercent() != null) {
            double exam = input.examScorePercent();
            int examPoints = exam < 50 ? MAX_EXAM_POINTS : exam < 70 ? 8 : 0;
            if (examPoints > 0) {
                factors.add(new RiskFactor(
                        "LOW_EXAM_SCORE",
                        "Low exam score",
                        examPoints,
                        "Average exam score is " + Math.round(exam) + "% of the maximum score"));
            }
        }

        // 5. Thời gian học ít hơn mức kỳ vọng (tối đa 10 điểm).
        if (input.expectedStudySeconds() > 0) {
            double ratio = input.studySeconds() / (double) input.expectedStudySeconds();
            int studyPoints = ratio < 0.5 ? MAX_STUDY_TIME_POINTS : ratio < 0.8 ? 5 : 0;
            if (studyPoints > 0) {
                factors.add(new RiskFactor(
                        "LOW_STUDY_TIME",
                        "Less study time than expected",
                        studyPoints,
                        "Studied " + Math.round(ratio * 100) + "% of the expected time for this progress"));
            }
        }

        int total = factors.stream().mapToInt(RiskFactor::points).sum();
        int capped = Math.min(100, total);

        factors.sort((a, b) -> Integer.compare(b.points(), a.points()));
        String primary = factors.isEmpty() ? "NONE" : factors.get(0).code();

        return new Result(capped, level(capped), List.copyOf(factors), primary);
    }

    private static int inactivityPoints(long idleDays, int threshold) {
        int safeThreshold = threshold <= 0 ? DEFAULT_INACTIVE_DAYS : threshold;
        if (idleDays >= 3L * safeThreshold) {
            return MAX_INACTIVITY_POINTS;
        }
        if (idleDays >= 2L * safeThreshold) {
            return 30;
        }
        if (idleDays >= safeThreshold) {
            return 20;
        }
        return 0;
    }

    /** Phân loại mức rủi ro theo điểm. */
    public static String level(int score) {
        if (score >= 60) {
            return "HIGH";
        }
        if (score >= 35) {
            return "MEDIUM";
        }
        return "LOW";
    }

    /**
     * Số giây học "kỳ vọng" ứng với tiến độ hiện tại.
     *
     * @param progressPercentage tiến độ (0-100)
     * @param totalCourseSeconds tổng thời lượng bài học của khóa (giây)
     */
    public static long expectedStudySeconds(double progressPercentage, long totalCourseSeconds) {
        if (totalCourseSeconds <= 0) {
            return 0;
        }
        return Math.round(totalCourseSeconds * Math.max(0, Math.min(100, progressPercentage)) / 100.0);
    }
}