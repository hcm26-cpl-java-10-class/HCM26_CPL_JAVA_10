package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.Granularity;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.CourseComparisonItem;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.CourseComparisonResponse;
import com.example.starter_project_2025.system.demo.analytics.CourseComparisonDTO.ModuleInsight;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.report.CourseReportRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.ToDoubleFunction;

/**
 * So sánh giữa các khóa học theo từng module của Course Analytics.
 *
 * <p>Service này gom số liệu của <b>tất cả</b> các khóa học mà người dùng được xem
 * rồi đặt chúng cạnh nhau, kèm thứ hạng và nhận định cho từng module:
 * phễu học tập, xu hướng, hoạt động/rủi ro, đánh giá, phòng ban, xếp hạng,
 * chất lượng nội dung và thời gian học.
 *
 * <p>Phần "bài thi" được bỏ qua vì dữ liệu seed hiện tại không có lượt thi nào.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseComparisonService {

    private static final int DEFAULT_INACTIVE_DAYS = 14;
    private static final int TREND_DAYS = 30;

    private final CourseAnalyticsRepository analyticsRepository;
    private final CourseReportRepository courseReportRepository;
    private final LessonRepository lessonRepository;

    // =====================================================================
    // Entry point
    // =====================================================================

    public CourseComparisonResponse compareCourses(LocalDate from, LocalDate to,
                                                    Granularity granularity, Integer inactiveDays) {
        List<Course> courses = getAccessibleCourses();
        int threshold = inactiveDays == null ? DEFAULT_INACTIVE_DAYS : Math.max(1, Math.min(inactiveDays, 365));

        if (courses.isEmpty()) {
            return new CourseComparisonResponse(0, from, to, granularity, threshold, List.of(), List.of());
        }

        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(TREND_DAYS - 1);
        Granularity g = granularity != null ? granularity : Granularity.DAY;

        List<Row> rows = new ArrayList<>();
        for (Course course : courses) {
            rows.add(buildRow(course, start, end, threshold));
        }

        applyRanks(rows);
        applyOverallScore(rows);
        applyModuleEvaluations(rows);

        List<CourseComparisonItem> items = rows.stream().map(Row::toItem).toList();
        List<ModuleInsight> modules = buildInsights(items, start, end);

        return new CourseComparisonResponse(courses.size(), start, end, g, threshold, items, modules);
    }

    // =====================================================================
    // Gom số liệu của một khóa học
    // =====================================================================

    private Row buildRow(Course course, LocalDate start, LocalDate end, int threshold) {
        Long courseId = course.getId();
        Row row = new Row(courseId, course.getName(), course.getInstructor());

        long lessonCount = analyticsRepository.countActiveLessons(courseId);
        LocalDateTime now = LocalDateTime.now();

        // ----- Tổng quan: học viên, hoàn thành, hoạt động, bỏ học -----
        for (Object[] r : analyticsRepository.findEnrollmentActivityDetail()) {
            if (!Objects.equals(r[0], courseId)) {
                continue;
            }
            row.learnerCount++;
            long done = ((Number) r[4]).longValue();
            if (lessonCount > 0 && done >= lessonCount) {
                row.completedLearners++;
                continue;
            }
            LocalDateTime lastAccessed = (LocalDateTime) r[2];
            LocalDateTime createdAt = (LocalDateTime) r[3];
            boolean never = lastAccessed == null && done == 0;
            long idleDays = idleDays(lastAccessed, createdAt, now);

            if (never) {
                row.neverStarted++;
            } else if (idleDays >= threshold) {
                row.inactive++;
            } else {
                row.active++;
            }
            if (idleDays >= threshold) {
                row.dropped++;
            }
        }
        row.completionRate = pct(row.completedLearners, row.learnerCount);
        row.notCompletedRate = row.learnerCount == 0 ? 0 : round1(100 - row.completionRate);
        row.dropOffRate = pct(row.dropped, row.learnerCount);
        row.activeRate = pct(row.active, row.learnerCount);

        // ----- 1. Phễu học tập -----
        List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(courseId);
        Map<Long, long[]> progressByLesson = new HashMap<>();
        for (Object[] r : analyticsRepository.countLessonProgress(courseId)) {
            progressByLesson.put((Long) r[0], new long[]{
                    ((Number) r[1]).longValue(),
                    r[2] == null ? 0L : ((Number) r[2]).longValue()
            });
        }
        row.funnelTotalLessons = lessons.size();
        double avgLessonCompletion = 0;
        double previousRate = 0;
        int index = 0;
        for (Lesson lesson : lessons) {
            index++;
            long[] counts = progressByLesson.getOrDefault(lesson.getId(), new long[]{0, 0});
            double rate = pct(counts[1], row.learnerCount);
            avgLessonCompletion += rate;
            if (index == 1) {
                row.funnelFirstLessonRate = rate;
            }
            if (index > 1) {
                double drop = Math.max(0, previousRate - rate);
                if (drop > row.funnelMaxDropOff) {
                    row.funnelMaxDropOff = drop;
                    row.funnelMaxDropOffLesson = lesson.getTitle();
                }
            }
            previousRate = rate;
            row.funnelLastLessonRate = rate;
            if (row.funnelLowestLesson == null || rate < row.funnelLowestLessonRate) {
                row.funnelLowestLessonRate = rate;
                row.funnelLowestLesson = lesson.getTitle();
            }
        }
        if (!lessons.isEmpty()) {
            row.funnelAvgCompletion = round1(avgLessonCompletion / lessons.size());
        }

        // ----- 2. Xu hướng theo thời gian -----
        LocalDateTime fromTime = start.atStartOfDay();
        LocalDateTime toTime = end.plusDays(1).atStartOfDay();
        row.trendEnrollments = analyticsRepository.findEnrollmentTimes(courseId, fromTime, toTime).size();
        row.trendLessonsCompleted = analyticsRepository.findLessonCompletionTimes(courseId, fromTime, toTime).size();
        row.trendCertificates = analyticsRepository.findCertificateDates(courseId, start, end).size();
        long days = Math.max(1, ChronoUnit.DAYS.between(start, end) + 1);
        row.trendEnrollmentsPerDay = round2(row.trendEnrollments / (double) days);

        // ----- 3. Rủi ro bỏ học -----
        Map<Long, long[]> studyByEnrollment = new HashMap<>();
        for (Object[] r : analyticsRepository.aggregateLessonProgressByEnrollment(courseId)) {
            studyByEnrollment.put((Long) r[0], new long[]{
                    r[2] == null ? 0L : ((Number) r[2]).longValue(),
                    ((Number) r[3]).longValue()
            });
        }
        for (CourseEnrollment enrollment : analyticsRepository.findActiveEnrollmentsWithUser(courseId)) {
            long[] study = studyByEnrollment.getOrDefault(enrollment.getId(), new long[]{0L, 0L});
            long done = study[0];
            int progress = lessonCount == 0 ? 0 : (int) Math.round(done * 100.0 / lessonCount);
            if (lessonCount > 0 && progress >= 100) {
                continue;
            }
            boolean never = enrollment.getLastAccessedAt() == null && done == 0;
            long idleDays = idleDays(enrollment.getLastAccessedAt(), enrollment.getCreatedAt(), now);
            long expected = DropoutRiskScorer.expectedStudySeconds(progress, 0L);
            DropoutRiskScorer.Result risk = DropoutRiskScorer.score(new DropoutRiskScorer.Input(
                    progress, idleDays, threshold, null, study[1], expected, false, never));
            if ("HIGH".equals(risk.level()) || "MEDIUM".equals(risk.level())) {
                row.atRisk++;
                row.riskScoreSum += risk.score();
                if ("HIGH".equals(risk.level())) {
                    row.highRisk++;
                }
            }
        }
        row.atRiskRate = pct(row.atRisk, row.learnerCount);
        row.averageRiskScore = row.atRisk == 0 ? 0 : round1(row.riskScoreSum / row.atRisk);

        // ----- 4. Đánh giá -----
        long[] byStar = new long[6];
        for (Object[] r : analyticsRepository.aggregateRatingDistribution(courseId)) {
            // Query trả về [courseId, rating, count] -> rating nằm ở r[1].
            int star = ((Number) r[1]).intValue();
            long count = ((Number) r[2]).longValue();
            row.reviewTotal += count;
            if (star >= 1 && star <= 5) {
                byStar[star] += count;
            }
        }
        for (Object[] r : analyticsRepository.aggregateRatings(List.of(courseId))) {
            row.reviewAverageRating = round2(((Number) r[1]).doubleValue());
        }
        row.reviewCoverage = pct(row.reviewTotal, row.learnerCount);
        row.reviewFiveStarRate = pct(byStar[5], row.reviewTotal);
        row.reviewLowStarRate = pct(byStar[1] + byStar[2], row.reviewTotal);

        // ----- 5. Phòng ban -----
        applyDepartmentStats(row, courseId, lessonCount);

        // ----- 6. Chất lượng nội dung & Q&A -----
        for (Object[] r : analyticsRepository.countReportsByLesson(courseId)) {
            row.contentTotalReports += ((Number) r[1]).longValue();
            row.contentOpenReports += r[2] == null ? 0 : ((Number) r[2]).longValue();
            row.contentResolvedReports += r[3] == null ? 0 : ((Number) r[3]).longValue();
        }
        double responseHoursSum = 0;
        long responseCount = 0;
        for (Object[] r : analyticsRepository.findQuestionsWithFirstAnswer(courseId)) {
            row.contentTotalQuestions++;
            LocalDateTime answeredAt = (LocalDateTime) r[2];
            LocalDateTime asked = (LocalDateTime) r[1];
            if (answeredAt != null) {
                row.contentAnsweredQuestions++;
                if (asked != null) {
                    responseHoursSum += java.time.Duration.between(asked, answeredAt).toMinutes() / 60.0;
                    responseCount++;
                }
            }
        }
        row.contentUnanswered = row.contentTotalQuestions - row.contentAnsweredQuestions;
        row.contentResolvedRate = pct(row.contentResolvedReports, row.contentTotalReports);
        row.contentAnswerRate = pct(row.contentAnsweredQuestions, row.contentTotalQuestions);
        row.contentAverageResponseHours = responseCount == 0 ? null : round2(responseHoursSum / responseCount);

        // ----- 7. Thời gian học -----
        for (Object[] r : analyticsRepository.findStudyTimeByLearner(courseId)) {
            long seconds = ((Number) r[4]).longValue();
            row.totalStudySeconds += seconds;
            row.studyLearners++;
            row.maxStudyHours = Math.max(row.maxStudyHours, seconds / 3600.0);
        }
        row.studyTotalHours = round2(row.totalStudySeconds / 3600.0);
        row.studyAverageHours = row.studyLearners == 0 ? 0
                : round2(row.totalStudySeconds / 3600.0 / row.studyLearners);

        return row;
    }

    private void applyDepartmentStats(Row row, Long courseId, long lessonCount) {
        Map<Long, Set<Long>> enrollmentsByDept = new LinkedHashMap<>();
        Map<Long, Set<Long>> completedByDept = new LinkedHashMap<>();
        Map<Long, String> nameByDept = new LinkedHashMap<>();

        for (Object[] r : analyticsRepository.findDepartmentEnrollmentsWithProgressByCourse(courseId)) {
            Long deptId = r[0] == null ? -1L : (Long) r[0];
            nameByDept.put(deptId, r[0] == null ? "Chưa phân phòng ban" : (String) r[2]);
            Long enrollmentId = (Long) r[3];
            long done = ((Number) r[5]).longValue();
            enrollmentsByDept.computeIfAbsent(deptId, k -> new LinkedHashSet<>()).add(enrollmentId);
            if (lessonCount > 0 && done >= lessonCount) {
                completedByDept.computeIfAbsent(deptId, k -> new LinkedHashSet<>()).add(enrollmentId);
            }
        }

        row.departmentCount = enrollmentsByDept.size();
        if (enrollmentsByDept.isEmpty()) {
            return;
        }

        for (Map.Entry<Long, Set<Long>> entry : enrollmentsByDept.entrySet()) {
            Long deptId = entry.getKey();
            long count = entry.getValue().size();
            long completed = completedByDept.getOrDefault(deptId, Set.of()).size();
            double rate = pct(completed, count);
            String name = nameByDept.getOrDefault(deptId, "");
            if (row.departmentBest == null || rate > row.departmentBestRate) {
                row.departmentBestRate = rate;
                row.departmentBest = name;
            }
            if (row.departmentWorst == null || rate < row.departmentWorstRate) {
                row.departmentWorstRate = rate;
                row.departmentWorst = name;
            }
        }
        row.departmentGap = round1(row.departmentBestRate - row.departmentWorstRate);
    }

    // =====================================================================
    // Xếp hạng theo từng module
    // =====================================================================

    private void applyRanks(List<Row> rows) {
        // Quy ước: comparator sắp xếp TĂNG DẦN theo "điểm nghịch đảo" (phủ định giá trị),
        // nhờ đó rank 1 luôn là course TỐT NHẤT cho từng chỉ số (cao hơn = tốt, thấp hơn = tốt
        // với drop-off). Tránh dùng `.reversed()` sau `thenComparing` vì nó đảo cả khóa phụ.
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.funnelAvgCompletion)
                .thenComparingLong(r -> -r.learnerCount), (r, rank) -> r.funnelRank = rank);
        rankBy(rows, Comparator.comparingLong((Row r) -> -r.trendEnrollments)
                .thenComparingLong(r -> -r.learnerCount), (r, rank) -> r.trendRank = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.activeRate)
                .thenComparingLong(r -> -r.learnerCount), (r, rank) -> r.activityRank = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.reviewAverageRating)
                .thenComparingLong(r -> -r.reviewTotal), (r, rank) -> r.reviewRank = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.departmentGap)
                .thenComparingDouble(r -> -r.departmentBestRate), (r, rank) -> r.departmentRank = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.contentAnswerRate)
                .thenComparingDouble(r -> -r.contentResolvedRate), (r, rank) -> r.contentRank = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.studyAverageHours)
                .thenComparingLong(r -> -r.learnerCount), (r, rank) -> r.studyRank = rank);

        // 4 bảng xếp hạng toàn cục (giống tab Ranking).
        rankBy(rows, Comparator.comparingLong((Row r) -> -r.learnerCount),
                (r, rank) -> r.rankByLearners = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.completionRate),
                (r, rank) -> r.rankByCompletion = rank);
        rankBy(rows, Comparator.comparingDouble((Row r) -> -r.reviewAverageRating),
                (r, rank) -> r.rankByRating = rank);
        // drop-off: càng thấp càng tốt
        rankBy(rows, Comparator.comparingDouble((Row r) -> r.dropOffRate),
                (r, rank) -> r.rankByDropOff = rank);
    }

    private void rankBy(List<Row> rows, Comparator<Row> comparator, java.util.function.BiConsumer<Row, Integer> setter) {
        List<Row> sorted = new ArrayList<>(rows);
        sorted.sort(comparator);
        int rank = 1;
        for (Row row : sorted) {
            setter.accept(row, rank++);
        }
    }

    // =====================================================================
    // Điểm tổng hợp
    // =====================================================================

    private void applyOverallScore(List<Row> rows) {
        for (Row row : rows) {
            double completion = row.completionRate;
            double engagement = row.activeRate;
            double rating = row.reviewAverageRating * 20; // 5 sao -> 100
            double retention = 100 - row.dropOffRate;
            double content = (row.contentAnswerRate + row.contentResolvedRate) / 2;
            double study = row.studyAverageHours > 0 ? Math.min(100, row.studyAverageHours * 50) : 0;

            double score = completion * 0.22
                    + engagement * 0.18
                    + rating * 0.20
                    + retention * 0.15
                    + content * 0.12
                    + study * 0.13;
            row.overallScore = Math.round(score * 10) / 10.0;
            row.overallVerdict = row.overallScore >= 80 ? "EXCELLENT"
                    : row.overallScore >= 60 ? "GOOD"
                    : row.overallScore >= 40 ? "AVERAGE" : "POOR";

            List<String> strengths = new ArrayList<>();
            List<String> weaknesses = new ArrayList<>();
            if (completion >= 50) {
                strengths.add("High course completion (" + fmt1(completion) + "%)");
            } else if (completion < 30) {
                weaknesses.add("Low course completion (" + fmt1(completion) + "%)");
            }
            if (rating >= 80) {
                strengths.add("Learners are satisfied (" + fmt2(row.reviewAverageRating) + "★)");
            } else if (rating > 0 && rating < 60) {
                weaknesses.add("Low learner rating (" + fmt2(row.reviewAverageRating) + "★)");
            }
            if (row.dropOffRate <= 20) {
                strengths.add("Low drop-off (" + fmt1(row.dropOffRate) + "%)");
            } else if (row.dropOffRate >= 50) {
                weaknesses.add("High drop-off (" + fmt1(row.dropOffRate) + "%)");
            }
            if (row.atRiskRate <= 20) {
                strengths.add("Few learners at risk (" + fmt1(row.atRiskRate) + "%)");
            } else if (row.atRiskRate >= 50) {
                weaknesses.add("Many learners at risk (" + fmt1(row.atRiskRate) + "%)");
            }
            if (row.contentAnswerRate >= 80) {
                strengths.add("Questions answered well (" + fmt1(row.contentAnswerRate) + "% answered)");
            } else if (row.contentTotalQuestions > 0 && row.contentAnswerRate < 60) {
                weaknesses.add("Many questions left unanswered (" + row.contentUnanswered + ")");
            }
            if (row.funnelMaxDropOff >= 20) {
                weaknesses.add("Big drop-off at \"" + row.funnelMaxDropOffLesson + "\"");
            }
            if (row.departmentGap >= 40) {
                weaknesses.add("Large gap between departments (" + fmt1(row.departmentGap) + " pts)");
            }
            if (strengths.isEmpty()) {
                strengths.add("Has learners enrolled (" + row.learnerCount + ")");
            }
            if (weaknesses.isEmpty()) {
                weaknesses.add("No critical issue detected in the compared metrics");
            }
            row.strengths = strengths;
            row.weaknesses = weaknesses;
        }
    }

    // =====================================================================
    // Nhận định riêng cho từng khóa học, theo từng module
    // =====================================================================

    /**
     * Sinh câu đánh giá riêng cho MỖI khóa học trong MỖI module.
     *
     * <p>Câu đánh giá luôn chứa 3 phần: chỉ số chính của khóa học đó, so sánh với
     * đầu/cuối bảng xếp hạng, và kết luận hành động cụ thể.
     */
    private void applyModuleEvaluations(List<Row> rows) {
        for (Row row : rows) {
            Map<String, String> evaluations = new LinkedHashMap<>();

            // ----- 1. Phễu học tập -----
            evaluations.put("funnel", String.format(
                    "Average lesson completion is %s%% across %d lessons (first lesson %s%%, last lesson %s%%). "
                            + "%s. %s",
                    fmt1(row.funnelAvgCompletion), row.funnelTotalLessons,
                    fmt1(row.funnelFirstLessonRate), fmt1(row.funnelLastLessonRate),
                    rankPhrase(row.funnelRank, "the funnel ranking"),
                    row.funnelMaxDropOff >= 20
                            ? "The biggest drop-off is \"" + row.funnelMaxDropOffLesson + "\" (-"
                            + fmt1(row.funnelMaxDropOff) + " pts), so that lesson should be reviewed first."
                            : "Drop-off between lessons stays under 20 pts, so the learning path is smooth."));

            // ----- 2. Xu hướng -----
            evaluations.put("trend", String.format(
                    "In the selected period the course gained %d new enrollments (%s/day), %d lessons completed "
                            + "and %d certificates issued. %s. %s",
                    row.trendEnrollments, fmt2(row.trendEnrollmentsPerDay),
                    row.trendLessonsCompleted, row.trendCertificates,
                    rankPhrase(row.trendRank, "the trend ranking"),
                    row.trendEnrollments == 0
                            ? "No new enrollment in this window - check whether promotion is needed."
                            : "Momentum is stable, keep the current acquisition channel."));

            // ----- 3. Hoạt động & rủi ro -----
            evaluations.put("activity", String.format(
                    "%s%% of learners are still active (%d active, %d inactive, %d never started). "
                            + "%s learners (%s%%) are flagged as at risk with an average risk score of %s. "
                            + "%s. %s",
                    fmt1(row.activeRate), row.active, row.inactive, row.neverStarted,
                    formatNumber(row.atRisk), fmt1(row.atRiskRate), fmt1(row.averageRiskScore),
                    rankPhrase(row.activityRank, "the activity ranking"),
                    row.atRiskRate >= 40
                            ? "Re-engagement campaigns should be launched for this course."
                            : "Engagement is healthy, no urgent intervention needed."));

            // ----- 4. Đánh giá -----
            evaluations.put("reviews", String.format(
                    "Average rating is %s★ from %d reviews (%s%% of learners reviewed). "
                            + "%s%% are 5-star and %s%% are 1-2 star. %s. %s",
                    fmt2(row.reviewAverageRating), row.reviewTotal, fmt1(row.reviewCoverage),
                    fmt1(row.reviewFiveStarRate), fmt1(row.reviewLowStarRate),
                    rankPhrase(row.reviewRank, "the rating ranking"),
                    row.reviewTotal == 0
                            ? "No review yet - ask learners for feedback to build a baseline."
                            : row.reviewLowStarRate >= 20
                            ? "A high share of low-star reviews needs a response from the instructor."
                            : "Satisfaction is solid and complaints are rare."));

            // ----- 5. Phòng ban -----
            evaluations.put("departments", String.format(
                    "The course covers %d departments. The best is %s (%s%% completion) and the weakest is %s "
                            + "(%s%% completion), a gap of %s pts. %s. %s",
                    row.departmentCount,
                    row.departmentBest == null ? "—" : row.departmentBest, fmt1(row.departmentBestRate),
                    row.departmentWorst == null ? "—" : row.departmentWorst, fmt1(row.departmentWorstRate),
                    fmt1(row.departmentGap),
                    rankPhrase(row.departmentRank, "the department ranking"),
                    row.departmentGap >= 40
                            ? "Delivery should be tailored per department to close the gap."
                            : "Performance is consistent across departments."));

            // ----- 6. Xếp hạng -----
            evaluations.put("ranking", String.format(
                    "Global ranking: #%d by learner count (%d learners), #%d by completion rate (%s%%), "
                            + "#%d by rating (%s★) and #%d by drop-off (%s%%). %s",
                    row.rankByLearners, row.learnerCount, row.rankByCompletion, fmt1(row.completionRate),
                    row.rankByRating, fmt2(row.reviewAverageRating), row.rankByDropOff, fmt1(row.dropOffRate),
                    row.rankByCompletion <= 2 && row.rankByDropOff <= 2
                            ? "The course performs strongly on both the quality and the retention tables."
                            : "Balance learner volume with quality: completion or drop-off still lags behind."));

            // ----- 7. Chất lượng nội dung & Q&A -----
            evaluations.put("content", String.format(
                    "There are %d content reports (%d still open, %s%% resolved) and %d questions (%s%% answered, "
                            + "%d still unanswered). %s. %s",
                    row.contentTotalReports, row.contentOpenReports, fmt1(row.contentResolvedRate),
                    row.contentTotalQuestions, fmt1(row.contentAnswerRate), row.contentUnanswered,
                    rankPhrase(row.contentRank, "the content ranking"),
                    row.contentOpenReports > 0
                            ? "Open reports should be triaged to protect the course quality."
                            : "Content quality is well maintained."));

            // ----- 8. Thời gian học -----
            evaluations.put("study-time", String.format(
                    "Learners invested %sh in total, %sh on average each, and the most engaged learner reached %sh. "
                            + "%s. %s",
                    fmt2(row.studyTotalHours), fmt2(row.studyAverageHours), fmt2(row.maxStudyHours),
                    rankPhrase(row.studyRank, "the study-time ranking"),
                    row.studyAverageHours <= 0
                            ? "No study time recorded yet - verify the tracking setup."
                            : row.studyAverageHours >= 5
                            ? "Learners spend a lot of time here, the content is deep but heavy."
                            : "Study time is reasonable for the course length."));

            row.moduleEvaluations = evaluations;
        }
    }

    /** Câu mô tả thứ hạng: "This course leads the funnel ranking." hoặc "This course ranks #3 in ...". */
    private static String rankPhrase(int rank, String rankingName) {
        return rank == 1
                ? "This course leads " + rankingName
                : "This course ranks #" + rank + " in " + rankingName;
    }

    // =====================================================================
    // Nhận định từng module
    // =====================================================================
    private List<ModuleInsight> buildInsights(List<CourseComparisonItem> items, LocalDate start, LocalDate end) {
        List<ModuleInsight> insights = new ArrayList<>();

        insights.add(insight(items, "overview", "Overall Comparison",
                "Health score of each course built from completion, engagement, rating, retention, content quality and study time.",
                "Overall health score",
                i -> i.overallScore(),
                overviewEvaluation(items)));

        insights.add(insight(items, "funnel", "Learning Funnel",
                "Average completion rate per lesson shows how well learners progress through the content.",
                "Average lesson completion",
                i -> i.funnelAvgCompletion(),
                String.format("Courses with fewer drop-offs between lessons keep more learners moving forward. "
                                + "Between %s and %s the average lesson completion spreads from %s%% to %s%%.",
                        start, end,
                        fmt1(minOf(items, i -> i.funnelAvgCompletion())),
                        fmt1(maxOf(items, i -> i.funnelAvgCompletion())))));

        insights.add(insight(items, "trend", "Trends",
                "New enrollments, lessons completed and certificates issued inside the selected period.",
                "New enrollments",
                i -> i.trendEnrollments(),
                String.format("Between %s and %s the courses registered %d new enrollments in total. "
                                + "%s attracted the most learners in this period.",
                        start, end,
                        items.stream().mapToLong(i -> i.trendEnrollments()).sum(),
                        maxName(items, i -> i.trendEnrollments()))));

        insights.add(insight(items, "activity", "Activity & Risk",
                "Share of learners still active and how many are flagged as at risk of dropping out.",
                "Active learner rate",
                i -> i.activityActiveRate(),
                String.format("Engagement differs clearly: the active rate ranges from %s%% to %s%%, "
                                + "and %s has the highest share of learners at risk of dropping out (%s%%).",
                        fmt1(minOf(items, i -> i.activityActiveRate())),
                        fmt1(maxOf(items, i -> i.activityActiveRate())),
                        maxName(items, i -> i.activityAtRiskRate()),
                        fmt1(maxOf(items, i -> i.activityAtRiskRate())))));

        insights.add(insight(items, "reviews", "Reviews",
                "Average rating, review volume and how many learners actually left a review.",
                "Average rating",
                i -> i.reviewAverageRating(),
                String.format("Satisfaction ranges from %s★ to %s★. "
                                + "%s has the highest review coverage (%s%% of learners reviewed), "
                                + "while %s has the lowest (%s%%).",
                        fmt2(minOf(items, i -> i.reviewAverageRating())),
                        fmt2(maxOf(items, i -> i.reviewAverageRating())),
                        maxName(items, i -> i.reviewCoverage()),
                        fmt1(maxOf(items, i -> i.reviewCoverage())),
                        minName(items, i -> i.reviewCoverage()),
                        fmt1(minOf(items, i -> i.reviewCoverage())))));

        insights.add(insight(items, "departments", "Departments",
                "How the same course performs across departments inside the organization.",
                "Completion gap between departments",
                i -> i.departmentGap(),
                String.format("The widest gap between the best and weakest department is %s points (%s), "
                                + "while %s keeps its departments closest together (%s points). "
                                + "A wide gap means training should be tailored per department instead of "
                                + "delivered the same way everywhere.",
                        fmt1(maxOf(items, i -> i.departmentGap())),
                        maxName(items, i -> i.departmentGap()),
                        minName(items, i -> i.departmentGap()),
                        fmt1(minOf(items, i -> i.departmentGap()))),
                true));

        insights.add(insight(items, "ranking", "Ranking",
                "The four ranking tables: learner count, completion rate, rating and drop-off rate.",
                "Completion rate",
                i -> i.completionRate(),
                String.format("%s leads on completion rate (%s%%) while %s has the most learners (%d). "
                                + "The highest drop-off belongs to %s (%s%%).",
                        maxName(items, i -> i.completionRate()),
                        fmt1(maxOf(items, i -> i.completionRate())),
                        maxName(items, i -> i.learnerCount()),
                        (long) maxOf(items, i -> i.learnerCount()),
                        maxName(items, i -> i.dropOffRate()),
                        fmt1(maxOf(items, i -> i.dropOffRate())))));

        insights.add(insight(items, "content", "Content & Q&A",
                "Reported content issues and how fast learner questions are answered.",
                "Answer rate",
                i -> i.contentAnswerRate(),
                String.format("Content health differs: the answer rate spans from %s%% to %s%%, "
                                + "and %s has the most open content reports (%d).",
                        fmt1(minOf(items, i -> i.contentAnswerRate())),
                        fmt1(maxOf(items, i -> i.contentAnswerRate())),
                        maxName(items, i -> i.contentOpenReports()),
                        (long) maxOf(items, i -> i.contentOpenReports()))));

        insights.add(insight(items, "study-time", "Study Time",
                "Total and per-learner study hours invested in each course.",
                "Average study hours per learner",
                i -> i.studyAverageHours(),
                String.format("Learners invest between %sh and %sh on average per course. "
                                + "%s logged the most total study time (%sh).",
                        fmt2(minOf(items, i -> i.studyAverageHours())),
                        fmt2(maxOf(items, i -> i.studyAverageHours())),
                        maxName(items, i -> i.studyTotalHours()),
                        fmt2(maxOf(items, i -> i.studyTotalHours())))));

        return insights;
    }

    /** Câu đánh giá tổng quan: khóa dẫn đầu, khóa cần cải thiện và khoảng điểm. */
    private static String overviewEvaluation(List<CourseComparisonItem> items) {
        if (items.isEmpty()) {
            return "No courses to compare yet.";
        }
        CourseComparisonItem best = items.stream()
                .max(java.util.Comparator.comparingDouble(CourseComparisonItem::overallScore)).orElseThrow();
        CourseComparisonItem worst = items.stream()
                .min(java.util.Comparator.comparingDouble(CourseComparisonItem::overallScore)).orElseThrow();
        if (items.size() == 1) {
            return String.format("%s has a health score of %s (%s).",
                    best.courseName(), fmt1(best.overallScore()), best.overallVerdict());
        }
        if (best.courseId().equals(worst.courseId()) || best.overallScore() == worst.overallScore()) {
            return String.format("All %d courses have the same health score (%s).",
                    items.size(), fmt1(best.overallScore()));
        }
        double average = items.stream().mapToDouble(CourseComparisonItem::overallScore).average().orElse(0);
        return String.format("%s leads with a health score of %s (%s), while %s needs the most improvement (%s, %s). "
                        + "Across %d courses the score ranges from %s to %s, with an average of %s.",
                best.courseName(), fmt1(best.overallScore()), best.overallVerdict(),
                worst.courseName(), fmt1(worst.overallScore()), worst.overallVerdict(),
                items.size(), fmt1(worst.overallScore()), fmt1(best.overallScore()), fmt1(average));
    }

    private ModuleInsight insight(List<CourseComparisonItem> items, String key, String title,
                                  String description, String bestMetric,
                                  ToDoubleFunction<CourseComparisonItem> metric,
                                  String evaluation) {
        return insight(items, key, title, description, bestMetric, metric, evaluation, false);
    }

    /**
     * @param lowerIsBetter true khi chỉ số càng NHỎ càng tốt (ví dụ: chênh lệch giữa
     *                      các phòng ban, tỉ lệ bỏ học). Khi đó "khóa học tốt nhất"
     *                      là khóa có giá trị nhỏ nhất, ngược lại với mặc định.
     */
    private ModuleInsight insight(List<CourseComparisonItem> items, String key, String title,
                                  String description, String bestMetric,
                                  ToDoubleFunction<CourseComparisonItem> metric,
                                  String evaluation,
                                  boolean lowerIsBetter) {
        if (items.isEmpty()) {
            return new ModuleInsight(key, title, description, bestMetric,
                    null, null, null, null, null, null, evaluation);
        }
        CourseComparisonItem best = items.get(0);
        CourseComparisonItem worst = items.get(0);
        for (CourseComparisonItem item : items) {
            double value = metric.applyAsDouble(item);
            double bestValue = metric.applyAsDouble(best);
            double worstValue = metric.applyAsDouble(worst);
            boolean isBetter = lowerIsBetter ? value < bestValue : value > bestValue;
            boolean isWorse = lowerIsBetter ? value > worstValue : value < worstValue;
            if (isBetter) {
                best = item;
            }
            if (isWorse) {
                worst = item;
            }
        }
        return new ModuleInsight(key, title, description, bestMetric,
                best.courseId(), best.courseName(), round2(metric.applyAsDouble(best)),
                worst.courseId(), worst.courseName(), round2(metric.applyAsDouble(worst)),
                evaluation);
    }

    private static double maxOf(List<CourseComparisonItem> items, ToDoubleFunction<CourseComparisonItem> metric) {
        double max = Double.NEGATIVE_INFINITY;
        for (CourseComparisonItem item : items) {
            max = Math.max(max, metric.applyAsDouble(item));
        }
        return max == Double.NEGATIVE_INFINITY ? 0 : max;
    }

    private static double minOf(List<CourseComparisonItem> items, ToDoubleFunction<CourseComparisonItem> metric) {
        double min = Double.POSITIVE_INFINITY;
        for (CourseComparisonItem item : items) {
            min = Math.min(min, metric.applyAsDouble(item));
        }
        return min == Double.POSITIVE_INFINITY ? 0 : min;
    }

    /** Tên khóa học có giá trị LỚN NHẤT (dùng cho các câu kiểu "ai cao nhất"). */
    private static String maxName(List<CourseComparisonItem> items, ToDoubleFunction<CourseComparisonItem> metric) {
        CourseComparisonItem target = null;
        double max = Double.NEGATIVE_INFINITY;
        for (CourseComparisonItem item : items) {
            double value = metric.applyAsDouble(item);
            if (value > max) {
                max = value;
                target = item;
            }
        }
        return target == null ? "—" : target.courseName();
    }

    /** Tên khóa học có giá trị NHỎ NHẤT (dùng cho các câu kiểu "ai thấp nhất"). */
    private static String minName(List<CourseComparisonItem> items, ToDoubleFunction<CourseComparisonItem> metric) {
        CourseComparisonItem target = null;
        double min = Double.POSITIVE_INFINITY;
        for (CourseComparisonItem item : items) {
            double value = metric.applyAsDouble(item);
            if (value < min) {
                min = value;
                target = item;
            }
        }
        return target == null ? "—" : target.courseName();
    }

    // =====================================================================
    // Phân quyền
    // =====================================================================

    private List<Course> getAccessibleCourses() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return List.of();
        }
        if (isAdmin(auth)) {
            return courseReportRepository.findAllCoursesWithMeta();
        }
        if (auth.getPrincipal() instanceof com.example.starter_project_2025.security.UserPrincipal principal) {
            User user = principal.getUser();
            String fullName = user.getFullName() != null && !user.getFullName().isBlank()
                    ? user.getFullName().trim() : "___NON_EXISTING___";
            String email = user.getEmail() != null && !user.getEmail().isBlank()
                    ? user.getEmail().trim() : "___NON_EXISTING___";
            return courseReportRepository.findCoursesByTeacher(user.getId(), fullName, email);
        }
        return List.of();
    }

    private static boolean isAdmin(Authentication auth) {
        return auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()) || "ADMIN".equals(a.getAuthority()));
    }

    // =====================================================================
    // Row nội bộ (dùng để gom số liệu rồi mới tạo record cuối cùng)
    // =====================================================================

    private static final class Row {
        final Long courseId;
        final String courseName;
        final String instructor;

        long learnerCount;
        long completedLearners;
        long dropped;
        double completionRate;
        double notCompletedRate;
        double dropOffRate;

        int funnelTotalLessons;
        double funnelAvgCompletion;
        double funnelFirstLessonRate;
        double funnelLastLessonRate;
        double funnelMaxDropOff;
        String funnelMaxDropOffLesson;
        double funnelLowestLessonRate;
        String funnelLowestLesson;
        int funnelRank;

        long trendEnrollments;
        long trendLessonsCompleted;
        long trendCertificates;
        double trendEnrollmentsPerDay;
        int trendRank;

        long active;
        long inactive;
        long neverStarted;
        double activeRate;
        long atRisk;
        long highRisk;
        double atRiskRate;
        double riskScoreSum;
        double averageRiskScore;
        int activityRank;

        double reviewAverageRating;
        long reviewTotal;
        double reviewCoverage;
        double reviewFiveStarRate;
        double reviewLowStarRate;
        int reviewRank;

        int departmentCount;
        String departmentBest;
        double departmentBestRate;
        String departmentWorst;
        double departmentWorstRate;
        double departmentGap;
        int departmentRank;

        int rankByLearners;
        int rankByCompletion;
        int rankByRating;
        int rankByDropOff;

        long contentTotalReports;
        long contentOpenReports;
        long contentResolvedReports;
        double contentResolvedRate;
        long contentTotalQuestions;
        long contentAnsweredQuestions;
        long contentUnanswered;
        double contentAnswerRate;
        Double contentAverageResponseHours;
        int contentRank;

        long totalStudySeconds;
        int studyLearners;
        double studyTotalHours;
        double studyAverageHours;
        double maxStudyHours;
        int studyRank;

        double overallScore;
        String overallVerdict;
        List<String> strengths = List.of();
        List<String> weaknesses = List.of();
        /** Nhận định của khóa học này cho từng module (key = moduleKey). */
        Map<String, String> moduleEvaluations = Map.of();

        Row(Long courseId, String courseName, String instructor) {
            this.courseId = courseId;
            this.courseName = courseName;
            this.instructor = instructor;
        }

        CourseComparisonItem toItem() {
            return new CourseComparisonItem(
                    courseId, courseName, instructor,
                    learnerCount, completedLearners, completionRate, notCompletedRate, dropOffRate,
                    funnelTotalLessons, funnelAvgCompletion, funnelFirstLessonRate, funnelLastLessonRate,
                    funnelMaxDropOff, funnelMaxDropOffLesson, funnelLowestLessonRate, funnelLowestLesson,
                    funnelRank,
                    trendEnrollments, trendLessonsCompleted, trendCertificates, trendEnrollmentsPerDay, trendRank,
                    active, inactive, neverStarted, activeRate, atRisk, atRiskRate, averageRiskScore, activityRank,
                    reviewAverageRating, reviewTotal, reviewCoverage, reviewFiveStarRate, reviewLowStarRate, reviewRank,
                    departmentCount, departmentBest, departmentBestRate, departmentWorst, departmentWorstRate,
                    departmentGap, departmentRank,
                    rankByLearners, rankByCompletion, rankByRating, rankByDropOff,
                    contentTotalReports, contentOpenReports, contentResolvedRate, contentTotalQuestions,
                    contentUnanswered, contentAnswerRate, contentAverageResponseHours, contentRank,
                    studyTotalHours, studyAverageHours, round2(maxStudyHours), studyRank,
                    overallScore, overallVerdict, strengths, weaknesses, moduleEvaluations);
        }
    }

    // =====================================================================
    // Helper
    // =====================================================================

    private static long idleDays(LocalDateTime lastAccessed, LocalDateTime createdAt, LocalDateTime now) {
        LocalDateTime reference = lastAccessed != null
                ? lastAccessed
                : (createdAt != null ? createdAt : now);
        return Math.max(0, ChronoUnit.DAYS.between(reference, now));
    }

    /** Tỉ lệ phần trăm (0-100), làm tròn 1 chữ số. */
    private static double pct(long part, long total) {
        return total == 0 ? 0 : round1(part * 100.0 / total);
    }

    private static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    private static String fmt1(double v) {
        return String.format("%.1f", v);
    }

    private static String fmt2(double v) {
        return String.format("%.2f", v);
    }

    /** Số nguyên có dấu phân tách nghìn, dùng cho nhận định dạng văn bản. */
    private static String formatNumber(long v) {
        return String.format("%,d", v);
    }
}
