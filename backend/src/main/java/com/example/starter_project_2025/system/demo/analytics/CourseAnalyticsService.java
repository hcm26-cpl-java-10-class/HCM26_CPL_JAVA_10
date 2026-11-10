package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.*;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course_review.CourseReviewRepository;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.qna.LessonQuestion;
import com.example.starter_project_2025.system.demo.report.CourseReportRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.service.ExamResultStatisticsService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class CourseAnalyticsService {

    private static final int MAX_TREND_BUCKETS = 400;
    private static final int DEFAULT_INACTIVE_DAYS = 14;

    private final CourseAnalyticsRepository analyticsRepository;
    private final CourseReportRepository courseReportRepository;
    private final CourseReviewRepository courseReviewRepository;
    private final LessonRepository lessonRepository;

    // =====================================================================
    // 1. Lesson funnel
    // =====================================================================

    public LessonFunnelResponse getLessonFunnel(Long courseId) {
        Course course = requireAccessibleCourse(courseId);

        List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(courseId);
        long totalLearners = analyticsRepository.countActiveLearners(courseId);

        Map<Long, long[]> progressByLesson = new HashMap<>();
        for (Object[] row : analyticsRepository.countLessonProgress(courseId)) {
            progressByLesson.put((Long) row[0], new long[]{
                    ((Number) row[1]).longValue(),
                    row[2] == null ? 0L : ((Number) row[2]).longValue()
            });
        }

        List<LessonFunnelItem> items = new ArrayList<>();
        double previousRate = 0;
        int position = 0;
        for (Lesson lesson : lessons) {
            position++;
            long[] counts = progressByLesson.getOrDefault(lesson.getId(), new long[]{0, 0});
            double rate = totalLearners == 0 ? 0 : round1(counts[1] * 100.0 / totalLearners);
            double dropOff = position == 1 ? 0 : round1(Math.max(0, previousRate - rate));
            previousRate = rate;

            items.add(new LessonFunnelItem(
                    lesson.getId(),
                    lesson.getTitle(),
                    lesson.getContentType() == null ? null : lesson.getContentType().name(),
                    lesson.getSection().getId(),
                    lesson.getSection().getTitle(),
                    lesson.getSection().getOrderIndex() == null ? 0 : lesson.getSection().getOrderIndex(),
                    lesson.getOrderIndex() == null ? 0 : lesson.getOrderIndex(),
                    position,
                    counts[0],
                    counts[1],
                    rate,
                    dropOff));
        }

        LessonFunnelItem biggestDrop = items.stream()
                .filter(i -> i.dropOffFromPrevious() > 0)
                .max(Comparator.comparingDouble(LessonFunnelItem::dropOffFromPrevious))
                .orElse(null);
        LessonFunnelItem lowest = totalLearners == 0 ? null : items.stream()
                .min(Comparator.comparingDouble(LessonFunnelItem::completionRate))
                .orElse(null);

        return new LessonFunnelResponse(courseId, course.getName(), totalLearners,
                items.size(), biggestDrop, lowest, items);
    }

    // =====================================================================
    // 2. Trend theo thời gian
    // =====================================================================

    public TrendResponse getTrend(Long courseId, LocalDate from, LocalDate to, Granularity granularity) {
        Course course = requireAccessibleCourse(courseId);

        LocalDate end = to != null ? to : LocalDate.now();
        LocalDate start = from != null ? from : end.minusDays(29);
        Granularity g = granularity != null ? granularity : Granularity.DAY;

        if (start.isAfter(end)) {
            throw new BadRequestException("'from' must not be after 'to'");
        }

        // Dựng sẵn các bucket (kể cả bucket rỗng) để biểu đồ liên tục.
        Map<LocalDate, long[]> buckets = new LinkedHashMap<>();
        LocalDate cursor = bucketStart(start, g);
        LocalDate lastBucket = bucketStart(end, g);
        while (!cursor.isAfter(lastBucket)) {
            if (buckets.size() >= MAX_TREND_BUCKETS) {
                throw new BadRequestException(
                        "Date range too large for granularity " + g + " (max " + MAX_TREND_BUCKETS + " points)");
            }
            buckets.put(cursor, new long[3]);
            cursor = next(cursor, g);
        }

        LocalDateTime fromTime = start.atStartOfDay();
        LocalDateTime toTime = end.plusDays(1).atStartOfDay();

        analyticsRepository.findEnrollmentTimes(courseId, fromTime, toTime)
                .forEach(t -> bump(buckets, bucketStart(t.toLocalDate(), g), 0));
        analyticsRepository.findLessonCompletionTimes(courseId, fromTime, toTime)
                .forEach(t -> bump(buckets, bucketStart(t.toLocalDate(), g), 1));
        analyticsRepository.findCertificateDates(courseId, start, end)
                .forEach(d -> bump(buckets, bucketStart(d, g), 2));

        List<TrendPoint> points = buckets.entrySet().stream()
                .map(e -> new TrendPoint(e.getKey(), e.getValue()[0], e.getValue()[1], e.getValue()[2]))
                .toList();

        return new TrendResponse(courseId, course.getName(), start, end, g,
                points.stream().mapToLong(TrendPoint::enrollments).sum(),
                points.stream().mapToLong(TrendPoint::lessonsCompleted).sum(),
                points.stream().mapToLong(TrendPoint::certificatesIssued).sum(),
                points);
    }

    private static void bump(Map<LocalDate, long[]> buckets, LocalDate key, int idx) {
        long[] arr = buckets.get(key);
        if (arr != null) {
            arr[idx]++;
        }
    }

    private static LocalDate bucketStart(LocalDate date, Granularity g) {
        return switch (g) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
        };
    }

    private static LocalDate next(LocalDate date, Granularity g) {
        return switch (g) {
            case DAY -> date.plusDays(1);
            case WEEK -> date.plusWeeks(1);
            case MONTH -> date.plusMonths(1);
        };
    }

    // =====================================================================
    // 3. Mức độ hoạt động + học viên nguy cơ bỏ học
    // =====================================================================

    public ActivityResponse getActivity(Long courseId, Integer inactiveDays, Integer limit) {
        Course course = requireAccessibleCourse(courseId);

        int threshold = inactiveDays == null ? DEFAULT_INACTIVE_DAYS : inactiveDays;
        if (threshold < 1 || threshold > 365) {
            throw new BadRequestException("inactiveDays must be between 1 and 365");
        }
        int maxRows = limit == null ? 50 : Math.max(1, Math.min(limit, 500));

        int lessonCount = lessonRepository.findActiveByCourseIdOrdered(courseId).size();
        List<CourseEnrollment> enrollments = analyticsRepository.findActiveEnrollmentsWithUser(courseId);

        Map<Long, Long> completedByEnrollment = new HashMap<>();
        for (Object[] row : analyticsRepository.countCompletedLessonsPerEnrollment(courseId)) {
            completedByEnrollment.put((Long) row[0], ((Number) row[1]).longValue());
        }

        LocalDateTime now = LocalDateTime.now();
        long completed = 0, active = 0, inactive = 0, neverStarted = 0;
        long[] dist = new long[6];
        List<AtRiskLearner> atRisk = new ArrayList<>();

        for (CourseEnrollment e : enrollments) {
            long done = completedByEnrollment.getOrDefault(e.getId(), 0L);
            int pct = lessonCount == 0 ? 0 : (int) Math.round(done * 100.0 / lessonCount);
            dist[distributionIndex(pct)]++;

            if (pct == 100) {
                completed++;
                continue;
            }

            boolean never = e.getLastAccessedAt() == null && done == 0;
            LocalDateTime reference = e.getLastAccessedAt() != null ? e.getLastAccessedAt() : e.getCreatedAt();
            long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));

            String reason = null;
            if (never) {
                neverStarted++;
                if (idleDays >= threshold) {
                    reason = "NEVER_STARTED";
                }
            } else if (idleDays >= threshold) {
                inactive++;
                reason = "INACTIVE";
            } else {
                active++;
            }

            if (reason != null) {
                User u = e.getUser();
                atRisk.add(new AtRiskLearner(
                        e.getId(), u.getId(), u.getFullName(), u.getEmail(), pct,
                        e.getCreatedAt(), e.getLastAccessedAt(), idleDays, reason,
                        riskLevel(idleDays, threshold, pct)));
            }
        }

        atRisk.sort(Comparator
                .comparingInt((AtRiskLearner a) -> riskOrder(a.riskLevel())).reversed()
                .thenComparing(Comparator.comparingLong(AtRiskLearner::inactiveDays).reversed()));
        List<AtRiskLearner> top = atRisk.size() > maxRows ? atRisk.subList(0, maxRows) : atRisk;

        List<ProgressBucket> distribution = List.of(
                new ProgressBucket("0%", dist[0]),
                new ProgressBucket("1-25%", dist[1]),
                new ProgressBucket("26-50%", dist[2]),
                new ProgressBucket("51-75%", dist[3]),
                new ProgressBucket("76-99%", dist[4]),
                new ProgressBucket("100%", dist[5]));

        return new ActivityResponse(courseId, course.getName(), threshold, enrollments.size(),
                completed, active, inactive, neverStarted, distribution, top);
    }

    private static int distributionIndex(int pct) {
        if (pct <= 0) return 0;
        if (pct <= 25) return 1;
        if (pct <= 50) return 2;
        if (pct <= 75) return 3;
        if (pct < 100) return 4;
        return 5;
    }

    private static String riskLevel(long idleDays, int threshold, int pct) {
        int score = idleDays >= 3L * threshold ? 2 : idleDays >= 2L * threshold ? 1 : 0;
        if (pct < 25) {
            score = Math.min(2, score + 1);
        }
        return score == 2 ? "HIGH" : score == 1 ? "MEDIUM" : "LOW";
    }

    private static int riskOrder(String level) {
        return switch (level) {
            case "HIGH" -> 2;
            case "MEDIUM" -> 1;
            default -> 0;
        };
    }

    // =====================================================================
    // 4. Đánh giá khóa học
    // =====================================================================

    public CourseReviewAnalyticsResponse getReviewAnalytics(Long courseId) {
        Course course = requireAccessibleCourse(courseId);

        Double avg = courseReviewRepository.getAverageRating(courseId);
        Long total = courseReviewRepository.countReviews(courseId);
        long totalReviews = total == null ? 0 : total;
        long learners = analyticsRepository.countActiveLearners(courseId);

        long[] byStar = new long[6];
        for (Object[] row : courseReviewRepository.getRatingDistribution(courseId)) {
            int star = ((Number) row[0]).intValue();
            if (star >= 1 && star <= 5) {
                byStar[star] = ((Number) row[1]).longValue();
            }
        }

        List<RatingBucket> distribution = new ArrayList<>();
        for (int star = 5; star >= 1; star--) {
            distribution.add(new RatingBucket(star, byStar[star],
                    totalReviews == 0 ? 0 : round1(byStar[star] * 100.0 / totalReviews)));
        }

        return new CourseReviewAnalyticsResponse(courseId, course.getName(),
                avg == null ? 0 : round2(avg), totalReviews, learners,
                learners == 0 ? 0 : round1(totalReviews * 100.0 / learners), distribution);
    }

    /** Xếp hạng rating giữa các khóa học mà user hiện tại được xem (admin: tất cả, giảng viên: khóa của mình). */
    public List<CourseRatingRankItem> getCourseRatingRanking() {
        List<Course> courses = getAccessibleCourses();
        if (courses.isEmpty()) {
            return List.of();
        }

        Map<Long, double[]> stats = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateRatings(
                courses.stream().map(Course::getId).toList())) {
            stats.put((Long) row[0], new double[]{((Number) row[1]).doubleValue(), ((Number) row[2]).doubleValue()});
        }

        record Row(Course course, double avg, long count) {
        }
        List<Row> rows = courses.stream()
                .map(c -> {
                    double[] s = stats.get(c.getId());
                    return new Row(c, s == null ? 0 : round2(s[0]), s == null ? 0 : (long) s[1]);
                })
                .sorted(Comparator.comparingDouble(Row::avg).reversed()
                        .thenComparing(Comparator.comparingLong(Row::count).reversed())
                        .thenComparing(r -> r.course().getName(), Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();

        List<CourseRatingRankItem> result = new ArrayList<>();
        int rank = 1;
        for (Row r : rows) {
            result.add(new CourseRatingRankItem(rank++, r.course().getId(), r.course().getName(),
                    r.course().getInstructor(), r.avg(), r.count()));
        }
        return result;
    }

    // =====================================================================
    // 5. Kết quả bài thi gắn với course
    // =====================================================================

    public CourseExamAnalyticsResponse getExamAnalytics(Long courseId) {
        Course course = requireAccessibleCourse(courseId);

        List<Exam> exams = analyticsRepository.findActiveExamsByCourse(courseId);
        Map<Long, List<Object[]>> attemptsByExam = analyticsRepository.findAttemptRowsByCourse(courseId)
                .stream()
                .collect(Collectors.groupingBy(r -> (Long) r[0]));

        List<ExamAnalyticsItem> items = new ArrayList<>();
        long overallGraded = 0, overallPassed = 0;
        double overallPercentSum = 0;

        for (Exam exam : exams) {
            List<Object[]> rows = attemptsByExam.getOrDefault(exam.getId(), List.of());
            BigDecimal passThreshold = ExamResultStatisticsService.resolvePassThreshold(exam);
            BigDecimal max = exam.getMaxScore() == null || exam.getMaxScore().signum() <= 0
                    ? BigDecimal.TEN : exam.getMaxScore();

            Set<Long> participants = new HashSet<>();
            List<BigDecimal> scores = new ArrayList<>();
            for (Object[] r : rows) {
                participants.add((Long) r[1]);
                BigDecimal score = (BigDecimal) r[2];
                ExamAttemptStatus status = (ExamAttemptStatus) r[3];
                Object submittedAt = r[4];
                boolean graded = score != null && submittedAt != null
                        && (status == ExamAttemptStatus.SUBMITTED || status == ExamAttemptStatus.EXPIRED);
                if (graded) {
                    scores.add(score);
                }
            }

            long[] buckets = new long[5];
            long passed = 0;
            for (BigDecimal s : scores) {
                double pct = s.doubleValue() * 100.0 / max.doubleValue();
                buckets[Math.min(4, Math.max(0, (int) (pct / 20)))]++;
                overallPercentSum += pct;
                if (s.compareTo(passThreshold) >= 0) {
                    passed++;
                }
            }
            overallGraded += scores.size();
            overallPassed += passed;

            Double average = scores.isEmpty() ? null : round2(scores.stream()
                    .mapToDouble(BigDecimal::doubleValue).average().orElse(0));
            Double highest = scores.isEmpty() ? null : round2(scores.stream()
                    .mapToDouble(BigDecimal::doubleValue).max().orElse(0));
            Double lowest = scores.isEmpty() ? null : round2(scores.stream()
                    .mapToDouble(BigDecimal::doubleValue).min().orElse(0));

            items.add(new ExamAnalyticsItem(
                    exam.getId(), exam.getTitle(),
                    exam.getCategory() == null ? null : exam.getCategory().name(),
                    max, passThreshold, rows.size(), scores.size(), participants.size(),
                    average, highest, lowest, passed,
                    scores.isEmpty() ? null : round1(passed * 100.0 / scores.size()),
                    List.of(new ScoreBucket("0-20%", buckets[0]),
                            new ScoreBucket("20-40%", buckets[1]),
                            new ScoreBucket("40-60%", buckets[2]),
                            new ScoreBucket("60-80%", buckets[3]),
                            new ScoreBucket("80-100%", buckets[4]))));
        }

        return new CourseExamAnalyticsResponse(courseId, course.getName(), items.size(), overallGraded,
                overallGraded == 0 ? null : round1(overallPercentSum / overallGraded),
                overallGraded == 0 ? null : round1(overallPassed * 100.0 / overallGraded),
                items);
    }

    // =====================================================================
    // 6. Department analytics
    // =====================================================================

    /**
     * Phân tích hiệu quả đào tạo theo phòng ban. Khi {@code courseId} null thì tính trên
     * toàn bộ khóa học mà user được xem; ngược lại chỉ tính khóa học đó.
     */
    public DepartmentAnalyticsResponse getDepartmentAnalytics(Long courseId) {
        String scopeName;
        List<Object[]> rows;
        Map<Long, Long> examGraded = new HashMap<>();
        Map<Long, Double> examAvg = new HashMap<>();

        if (courseId != null) {
            Course course = requireAccessibleCourse(courseId);
            scopeName = course.getName();
            rows = analyticsRepository.findDepartmentEnrollmentsWithProgressByCourse(courseId);
            for (Object[] row : analyticsRepository.aggregateExamScoresByDepartment(courseId)) {
                examGraded.put((Long) row[0], ((Number) row[2]).longValue());
                examAvg.put((Long) row[0], ((Number) row[1]).doubleValue());
            }
        } else {
            scopeName = "Toàn hệ thống";
            rows = analyticsRepository.findDepartmentEnrollmentsWithProgress();
            for (Object[] row : analyticsRepository.aggregateExamScoresByDepartment(null)) {
                examGraded.put((Long) row[0], ((Number) row[2]).longValue());
                examAvg.put((Long) row[0], ((Number) row[1]).doubleValue());
            }
        }

        // Gom enrollment theo phòng ban.
        Map<Long, DepartmentAccumulator> acc = new LinkedHashMap<>();
        for (Object[] row : rows) {
            Long deptId = (Long) row[0];
            DepartmentAccumulator item = acc.computeIfAbsent(deptId,
                    id -> new DepartmentAccumulator(id, (String) row[1], (String) row[2]));

            Long courseOfEnrollment = (Long) row[4];
            long completedLessons = ((Number) row[5]).longValue();
            LocalDateTime lastAccessed = (LocalDateTime) row[6];

            item.learnerCount++;
            item.enrollments.add(new DepartmentEnrollment(
                    (Long) row[3], courseOfEnrollment, completedLessons, lastAccessed));
        }

        // Số bài học của từng khóa để tính % hoàn thành chính xác.
        Map<Long, Long> lessonCountByCourse = new HashMap<>();
        for (DepartmentAccumulator item : acc.values()) {
            for (DepartmentEnrollment enrollment : item.enrollments) {
                lessonCountByCourse.computeIfAbsent(enrollment.courseId(),
                        id -> analyticsRepository.countActiveLessons(id));
            }
        }

        LocalDateTime now = LocalDateTime.now();
        List<DepartmentAnalyticsItem> items = new ArrayList<>();
        long totalLearners = 0;

        for (DepartmentAccumulator item : acc.values()) {
            long learnerCount = item.learnerCount;
            totalLearners += learnerCount;

            long completed = 0;
            long active = 0;
            double progressSum = 0;

            for (DepartmentEnrollment enrollment : item.enrollments) {
                long lessonCount = lessonCountByCourse.getOrDefault(enrollment.courseId(), 0L);
                double progress = lessonCount == 0 ? 0
                        : Math.min(100, enrollment.completedLessons() * 100.0 / lessonCount);
                progressSum += progress;

                if (lessonCount > 0 && enrollment.completedLessons() >= lessonCount) {
                    completed++;
                }

                LocalDateTime reference = enrollment.lastAccessedAt() != null
                        ? enrollment.lastAccessedAt() : now;
                long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));
                if (idleDays < DEFAULT_INACTIVE_DAYS) {
                    active++;
                }
            }

            double completionRate = learnerCount == 0 ? 0 : round1(completed * 100.0 / learnerCount);
            double avgProgress = learnerCount == 0 ? 0 : round1(progressSum / learnerCount);
            Long graded = examGraded.get(item.id);

            items.add(new DepartmentAnalyticsItem(
                    item.id, item.code, item.name,
                    learnerCount, completed, completionRate, avgProgress,
                    graded == null ? null : round2(examAvg.get(item.id)),
                    graded == null ? 0 : graded,
                    active, learnerCount - active,
                    round1(100 - completionRate)));
        }

        items.sort(Comparator.comparingDouble(DepartmentAnalyticsItem::completionRate).reversed()
                .thenComparing(Comparator.comparingLong(DepartmentAnalyticsItem::learnerCount).reversed())
                .thenComparing(d -> d.departmentName(), Comparator.nullsLast(String::compareToIgnoreCase)));

        DepartmentAnalyticsItem best = items.isEmpty() ? null : items.get(0);
        DepartmentAnalyticsItem worst = items.size() < 2 ? null
                : items.stream().min(Comparator.comparingDouble(DepartmentAnalyticsItem::completionRate)
                .thenComparing(Comparator.comparingLong(DepartmentAnalyticsItem::learnerCount).reversed())).orElse(null);

        return new DepartmentAnalyticsResponse(courseId, scopeName, totalLearners,
                items.size(), best, worst, items);
    }

    /** Enrollment của một học viên trong phòng ban (dùng để tính tiến độ). */
    private record DepartmentEnrollment(
            Long enrollmentId,
            Long courseId,
            long completedLessons,
            LocalDateTime lastAccessedAt
    ) {
    }

    /** Bộ đếm tạm cho một phòng ban. */
    private static final class DepartmentAccumulator {
        private final Long id;
        private final String code;
        private final String name;
        private long learnerCount;
        private final List<DepartmentEnrollment> enrollments = new ArrayList<>();

        private DepartmentAccumulator(Long id, String code, String name) {
            this.id = id;
            this.code = code;
            this.name = name;
        }
    }

    // =====================================================================
    // 7. Course ranking
    // =====================================================================

    public CourseRankingResponse getCourseRanking() {
        List<Course> courses = getAccessibleCourses();
        if (courses.isEmpty()) {
            return new CourseRankingResponse(0, List.of(), List.of(), List.of(), List.of(), List.of());
        }

        Map<Long, Long> lessonCountByCourse = new HashMap<>();
        for (Course course : courses) {
            lessonCountByCourse.put(course.getId(), analyticsRepository.countActiveLessons(course.getId()));
        }

        // Gom số liệu theo khóa học.
        Map<Long, Long> learnersByCourse = new HashMap<>();
        Map<Long, Long> completedByCourse = new HashMap<>();
        Map<Long, Long> inactiveByCourse = new HashMap<>();
        Map<Long, Long> activeByCourse = new HashMap<>();

        List<Object[]> progressRows = analyticsRepository.findEnrollmentsWithCompletedLessons();
        Map<Long, Long> completedLessonsByEnrollment = new HashMap<>();
        Map<Long, Long> courseOfEnrollment = new HashMap<>();
        for (Object[] row : progressRows) {
            Long courseId = (Long) row[0];
            Long enrollmentId = (Long) row[1];
            long done = ((Number) row[2]).longValue();
            completedLessonsByEnrollment.put(enrollmentId, done);
            courseOfEnrollment.put(enrollmentId, courseId);
            learnersByCourse.merge(courseId, 1L, Long::sum);

            long threshold = lessonCountByCourse.getOrDefault(courseId, 0L);
            if (threshold > 0 && done >= threshold) {
                completedByCourse.merge(courseId, 1L, Long::sum);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        for (Object[] row : analyticsRepository.findEnrollmentActivity()) {
            Long courseId = (Long) row[0];
            LocalDateTime lastAccessed = (LocalDateTime) row[2];
            LocalDateTime reference = lastAccessed != null ? lastAccessed : now;
            long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));
            if (idleDays >= DEFAULT_INACTIVE_DAYS) {
                inactiveByCourse.merge(courseId, 1L, Long::sum);
            } else {
                activeByCourse.merge(courseId, 1L, Long::sum);
            }
        }

        Map<Long, double[]> ratingStats = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateRatings(
                courses.stream().map(Course::getId).toList())) {
            ratingStats.put((Long) row[0], new double[]{
                    ((Number) row[1]).doubleValue(),
                    ((Number) row[2]).doubleValue()
            });
        }

        List<CourseRankingItem> all = new ArrayList<>();
        for (Course course : courses) {
            Long courseId = course.getId();
            long learners = learnersByCourse.getOrDefault(courseId, 0L);
            long completed = completedByCourse.getOrDefault(courseId, 0L);
            long active = activeByCourse.getOrDefault(courseId, 0L);
            long inactive = inactiveByCourse.getOrDefault(courseId, 0L);
            double[] rating = ratingStats.get(courseId);

            double completionRate = learners == 0 ? 0 : round1(completed * 100.0 / learners);
            double dropOffRate = learners == 0 ? 0 : round1((learners - completed) * 100.0 / learners);

            all.add(new CourseRankingItem(
                    0, courseId, course.getName(), course.getInstructor(),
                    learners, completed, completionRate,
                    rating == null ? 0 : round2(rating[0]),
                    rating == null ? 0 : (long) rating[1],
                    active, inactive, dropOffRate));
        }

        all.sort(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()
                .thenComparing(c -> c.courseName(), Comparator.nullsLast(String::compareToIgnoreCase)));

        List<CourseRankingItem> topByLearners = ranked(all, null);

        List<CourseRankingItem> byCompletion = new ArrayList<>(all);
        byCompletion.sort(Comparator.comparingDouble(CourseRankingItem::completionRate).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()));
        List<CourseRankingItem> topByCompletion = ranked(byCompletion, null);

        List<CourseRankingItem> byRating = new ArrayList<>(all);
        byRating.sort(Comparator.comparingDouble(CourseRankingItem::averageRating).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::totalReviews).reversed()));
        List<CourseRankingItem> topByRating = ranked(byRating, null);

        List<CourseRankingItem> byDropOff = new ArrayList<>(all);
        byDropOff.sort(Comparator.comparingDouble(CourseRankingItem::dropOffRate).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()));
        List<CourseRankingItem> highestDropOff = ranked(byDropOff, null);

        return new CourseRankingResponse(courses.size(), topByLearners, topByCompletion,
                topByRating, highestDropOff, ranked(all, null));
    }

    /** Gán lại thứ hạng 1..n cho danh sách đã sắp xếp sẵn. */
    private static List<CourseRankingItem> ranked(List<CourseRankingItem> items, Comparator<CourseRankingItem> extra) {        List<CourseRankingItem> result = new ArrayList<>();
        int rank = 1;
        for (CourseRankingItem item : items) {
            result.add(new CourseRankingItem(rank++, item.courseId(), item.courseName(), item.instructor(),
                    item.learnerCount(), item.completedLearners(), item.completionRate(),
                    item.averageRating(), item.totalReviews(), item.activeLearners(),
                    item.inactiveLearners(), item.dropOffRate()));
        }
        return result;
    }

    // =====================================================================
    // 8. Content quality + Q&A
    // =====================================================================

    public ContentQualityResponse getContentQuality(Long courseId) {
        Course course = requireAccessibleCourse(courseId);

        // --- Bài học bị báo lỗi nhiều nhất ---
        Map<Long, long[]> reportStats = new HashMap<>();
        for (Object[] row : analyticsRepository.countReportsByLesson(courseId)) {
            reportStats.put((Long) row[0], new long[]{
                    ((Number) row[1]).longValue(),
                    row[2] == null ? 0 : ((Number) row[2]).longValue(),
                    row[3] == null ? 0 : ((Number) row[3]).longValue()
            });
        }

        Map<Long, Map<String, Long>> reasonByLesson = new HashMap<>();
        for (Object[] row : analyticsRepository.countReportsByLessonAndReason(courseId)) {
            reasonByLesson.computeIfAbsent((Long) row[0], k -> new HashMap<>())
                    .put(String.valueOf(row[1]), ((Number) row[2]).longValue());
        }

        Map<Long, Lesson> lessonsById = new HashMap<>();
        for (Lesson lesson : lessonRepository.findActiveByCourseIdOrdered(courseId)) {
            lessonsById.put(lesson.getId(), lesson);
        }

        List<ReportedLessonItem> reportedLessons = new ArrayList<>();
        for (Map.Entry<Long, long[]> entry : reportStats.entrySet()) {
            Lesson lesson = lessonsById.get(entry.getKey());
            if (lesson == null) {
                continue;
            }
            long[] stats = entry.getValue();
            Map<String, Long> reasons = reasonByLesson.getOrDefault(entry.getKey(), Map.of());
            String topReason = reasons.entrySet().stream()
                    .max(Map.Entry.comparingByValue())
                    .map(Map.Entry::getKey)
                    .orElse(null);

            reportedLessons.add(new ReportedLessonItem(
                    0, lesson.getId(), lesson.getTitle(),
                    courseId, course.getName(),
                    stats[0], stats[1], stats[2], topReason));
        }
        reportedLessons.sort(Comparator.comparingLong(ReportedLessonItem::reportCount).reversed()
                .thenComparing(r -> r.lessonTitle(), Comparator.nullsLast(String::compareToIgnoreCase)));

        // Gán lại thứ hạng 1..n sau khi sắp xếp.
        List<ReportedLessonItem> rankedLessons = new ArrayList<>();
        int lessonRank = 1;
        for (ReportedLessonItem item : reportedLessons) {
            rankedLessons.add(new ReportedLessonItem(lessonRank++, item.lessonId(), item.lessonTitle(),
                    item.courseId(), item.courseName(), item.reportCount(), item.openReports(),
                    item.resolvedReports(), item.topReason()));
        }
        reportedLessons = rankedLessons;

        // --- Phân loại báo cáo theo lý do ---
        long totalReports = reportStats.values().stream().mapToLong(s -> s[0]).sum();
        long openReports = reportStats.values().stream().mapToLong(s -> s[1]).sum();
        long resolvedReports = reportStats.values().stream().mapToLong(s -> s[2]).sum();

        List<ReportReasonBucket> reasonBuckets = new ArrayList<>();
        for (Object[] row : analyticsRepository.countReportsByReason(courseId)) {
            long count = ((Number) row[1]).longValue();
            reasonBuckets.add(new ReportReasonBucket(String.valueOf(row[0]), count,
                    totalReports == 0 ? 0 : round1(count * 100.0 / totalReports)));
        }
        reasonBuckets.sort(Comparator.comparingLong(ReportReasonBucket::count).reversed());

        // --- Câu hỏi & thời gian phản hồi ---
        List<Object[]> questionRows = analyticsRepository.findQuestionsWithFirstAnswer(courseId);
        long totalQuestions = questionRows.size();
        long answered = 0;
        double responseHoursSum = 0;
        long responseCount = 0;

        for (Object[] row : questionRows) {
            LocalDateTime asked = (LocalDateTime) row[1];
            LocalDateTime answeredAt = (LocalDateTime) row[2];
            if (answeredAt != null) {
                answered++;
                if (asked != null) {
                    responseHoursSum += java.time.Duration.between(asked, answeredAt).toMinutes() / 60.0;
                    responseCount++;
                }
            }
        }
        long unanswered = totalQuestions - answered;

        List<UnansweredQuestionItem> unansweredItems = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        for (LessonQuestion question : analyticsRepository.findUnansweredQuestions(courseId)) {
            Lesson lesson = lessonsById.get(question.getLesson().getId());
            LocalDateTime asked = question.getCreatedAt();
            long waitingHours = asked == null ? 0 : Math.max(0, java.time.Duration.between(asked, now).toHours());
            unansweredItems.add(new UnansweredQuestionItem(
                    question.getId(),
                    question.getLesson().getId(),
                    lesson == null ? null : lesson.getTitle(),
                    course.getName(),
                    question.getAuthor() == null ? null : question.getAuthor().getFullName(),
                    question.getContent(),
                    asked,
                    waitingHours));
        }

        Double avgResponseHours = responseCount == 0 ? null : round2(responseHoursSum / responseCount);

        return new ContentQualityResponse(courseId, course.getName(),
                totalReports, openReports, resolvedReports,
                totalQuestions, answered, unanswered,
                totalQuestions == 0 ? 0 : round1(answered * 100.0 / totalQuestions),
                avgResponseHours,
                reportedLessons, reasonBuckets, unansweredItems);    }

    // =====================================================================
    // Phân quyền: admin xem tất cả, giảng viên chỉ xem khóa của mình
    // (cùng quy tắc với CourseReportService)
    // =====================================================================

    private Course requireAccessibleCourse(Long courseId) {
        Course course = analyticsRepository.findCourseById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (isAdmin(auth)) {
            return course;
        }
        boolean allowed = getAccessibleCourses().stream().anyMatch(c -> Objects.equals(c.getId(), courseId));
        if (!allowed) {
            throw new AccessDeniedException("You do not have access to this course's analytics");
        }
        return course;
    }

    private List<Course> getAccessibleCourses() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            return List.of();
        }
        if (isAdmin(auth)) {
            return courseReportRepository.findAllCoursesWithMeta();
        }
        if (auth.getPrincipal() instanceof UserPrincipal principal) {
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

    private static double round1(double v) {
        return BigDecimal.valueOf(v).setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private static double round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
