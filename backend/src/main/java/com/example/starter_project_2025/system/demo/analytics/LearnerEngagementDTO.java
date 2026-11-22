package com.example.starter_project_2025.system.demo.analytics;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO cho 3 chức năng mở rộng của Course Analytics:
 * <ol>
 *   <li>Điểm nghẽn / nơi người học bỏ học theo từng bài (bottlenecks)</li>
 *   <li>Danh sách người học có vấn đề + gửi thông báo nhắc học (nudges)</li>
 *   <li>Top người học chăm nhất theo phòng ban và toàn hệ thống (leaderboard)</li>
 * </ol>
 */
public final class LearnerEngagementDTO {

    private LearnerEngagementDTO() {
    }

    // =====================================================================
    // 1. Bottlenecks
    // =====================================================================

    /** Số liệu điểm nghẽn của một bài học. */
    public record LessonBottleneckItem(
            Long lessonId,
            String lessonTitle,
            String contentType,
            Long sectionId,
            String sectionTitle,
            /** Vị trí 1..n của bài trong toàn khóa. */
            int position,
            /** Số học viên đã mở bài. */
            long startedCount,
            /** Số học viên đã hoàn thành bài. */
            long completedCount,
            /** completedCount / tổng học viên (0-100). */
            double completionRate,
            /** Điểm % tụt so với bài liền trước (>= 0). */
            double dropOffFromPrevious,
            /** Đã mở nhưng chưa hoàn thành bài. */
            long stuckCount,
            /** stuckCount / startedCount (0-100). */
            double stuckRate,
            /** Số học viên bỏ học (không hoạt động, chưa xong khóa) mà bài này là bài cuối họ chạm tới. */
            long dropoutCount,
            /** dropoutCount / tổng học viên (0-100). */
            double dropoutRate,
            /** Thời gian học trung bình của người đã mở bài (giây). */
            long avgStudySeconds,
            /** Thời lượng dự kiến của bài (giây), 0 nếu không có. */
            long expectedSeconds,
            /** avgStudySeconds / expectedSeconds, null nếu không có thời lượng dự kiến. */
            Double timeRatio,
            /** Số báo cáo lỗi của bài. */
            long reportCount,
            /** Điểm nghẽn 0-100 (càng cao càng nghẽn). */
            int bottleneckScore,
            /** HIGH | MEDIUM | NONE */
            String severity,
            /** HIGH_DROP_OFF | HIGH_DROPOUT | MANY_STUCK | SLOW_COMPLETION | REPORTED */
            List<String> reasons
    ) {
    }

    /** Tổng hợp theo section. */
    public record SectionBottleneckItem(
            Long sectionId,
            String sectionTitle,
            int lessonCount,
            double averageCompletionRate,
            long dropoutCount,
            double dropoutRate
    ) {
    }

    public record BottleneckResponse(
            Long courseId,
            String courseName,
            int inactiveThresholdDays,
            long totalLearners,
            /** Học viên chưa hoàn thành và không hoạt động >= ngưỡng. */
            long droppedLearners,
            /** Trong số đó, số người chưa từng mở bài nào. */
            long neverStartedDropouts,
            /** Bài có nhiều người bỏ học nhất (null nếu chưa có ai bỏ học). */
            LessonBottleneckItem topDropoutLesson,
            /** Các bài nghẽn nhất (điểm cao nhất, tối đa 5). */
            List<LessonBottleneckItem> bottlenecks,
            List<SectionBottleneckItem> sections,
            List<LessonBottleneckItem> lessons
    ) {
    }

    // =====================================================================
    // 2. Problem learners + nudges
    // =====================================================================

    /** Người học có vấn đề với khóa học. */
    public record ProblemLearner(
            Long enrollmentId,
            Long userId,
            String studentName,
            String studentEmail,
            String departmentName,
            int progressPercentage,
            long inactiveDays,
            LocalDateTime enrolledAt,
            LocalDateTime lastAccessedAt,
            /** NEVER_STARTED | DROPPED_OUT | INACTIVE | LOW_EXAM_SCORE (vấn đề chính). */
            String primaryProblem,
            /** Tất cả vấn đề áp dụng cho người học. */
            List<String> problems,
            /** HIGH | MEDIUM | LOW */
            String riskLevel,
            int riskScore,
            Double examScorePercent,
            /** Bài cuối cùng người học chạm tới (null nếu chưa mở bài nào). */
            Long lastLessonId,
            String lastLessonTitle,
            /** Bài tiếp theo cần học (bài chưa hoàn thành đầu tiên). */
            Long nextLessonId,
            String nextLessonTitle,
            /** Lần cuối đã gửi nhắc học cho khóa này (null nếu chưa). */
            LocalDateTime lastNudgedAt,
            int nudgeCount,
            /** Có thể nhắc ngay (ngoài thời gian cooldown). */
            boolean canNudge
    ) {
    }

    public record ProblemLearnersResponse(
            Long courseId,
            String courseName,
            int inactiveThresholdDays,
            int cooldownDays,
            long totalLearners,
            long totalProblemLearners,
            long neverStartedCount,
            long droppedOutCount,
            long inactiveCount,
            long lowExamScoreCount,
            List<ProblemLearner> learners
    ) {
    }

    /** Yêu cầu gửi thông báo nhắc học. */
    public record NudgeRequest(
            /** Danh sách userId cần nhắc; rỗng/null = tất cả người học có vấn đề khớp {@code problemType}. */
            List<Long> userIds,
            /** Lọc theo loại vấn đề khi userIds rỗng: NEVER_STARTED | DROPPED_OUT | INACTIVE | LOW_EXAM_SCORE. */
            String problemType,
            Integer inactiveDays
    ) {
    }

    public record NudgeResult(
            long requested,
            long sent,
            /** Bỏ qua vì đã nhắc trong thời gian cooldown. */
            long skippedCooldown,
            /** Bỏ qua vì không thuộc nhóm người học có vấn đề. */
            long skippedNotEligible,
            List<Long> sentUserIds
    ) {
    }

    // =====================================================================
    // 3. Department leaderboard
    // =====================================================================

    public record TopLearnerItem(
            int rank,
            Long userId,
            String studentName,
            String studentEmail,
            /** Phòng ban chính (null/UNASSIGNED nếu chưa gán). */
            String departmentName,
            long studySeconds,
            double studyHours,
            long lessonsCompleted,
            int coursesEnrolled,
            int coursesCompleted,
            LocalDateTime lastAccessedAt
    ) {
    }

    public record DepartmentTopLearners(
            Long departmentId,
            String departmentCode,
            String departmentName,
            /** Số người học (distinct) của phòng ban trong phạm vi. */
            long learnerCount,
            /** Số người học thực sự có hoạt động học. */
            long activeLearnerCount,
            double totalStudyHours,
            List<TopLearnerItem> topLearners
    ) {
    }

    public record TopLearnersResponse(
            /** null khi xem toàn hệ thống. */
            Long courseId,
            String courseName,
            int limit,
            /** STUDY_TIME | LESSONS_COMPLETED */
            String sortBy,
            long totalLearners,
            /** Top N chăm chỉ nhất của cả hệ thống (trong phạm vi). */
            List<TopLearnerItem> systemTopLearners,
            /** Top N của từng phòng ban. */
            List<DepartmentTopLearners> departments
    ) {
    }
}
