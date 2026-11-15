package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsDTO.*;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course_review.CourseReviewRepository;
import com.example.starter_project_2025.system.demo.department.Department;
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
    /** Id giả cho nhóm học viên chưa thuộc phòng ban nào. */
    private static final long UNASSIGNED_DEPARTMENT_ID = -1L;
    private static final String UNASSIGNED_DEPARTMENT_CODE = "UNASSIGNED";
    private static final String UNASSIGNED_DEPARTMENT_NAME = "Chưa phân phòng ban";

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
    // 3. Mức độ hoạt động + dự đoán rủi ro bỏ học
    // =====================================================================

    public ActivityResponse getActivity(Long courseId, Integer inactiveDays, Integer limit) {
        Course course = requireAccessibleCourse(courseId);

        int threshold = inactiveDays == null ? DEFAULT_INACTIVE_DAYS : inactiveDays;
        if (threshold < 1 || threshold > 365) {
            throw new BadRequestException("inactiveDays must be between 1 and 365");
        }
        int maxRows = limit == null ? 50 : Math.max(1, Math.min(limit, 500));

        ActivityComputation computation = computeActivity(courseId, threshold);
        List<AtRiskLearner> atRisk = computation.atRisk;

        atRisk.sort(Comparator
                .comparingInt((AtRiskLearner a) -> a.riskScore()).reversed()
                .thenComparing(Comparator.comparingLong(AtRiskLearner::inactiveDays).reversed()));
        List<AtRiskLearner> top = atRisk.size() > maxRows ? atRisk.subList(0, maxRows) : atRisk;

        long high = computation.highRisk;
        long medium = computation.mediumRisk;
        long low = computation.lowRisk;

        List<RiskLevelBucket> riskDistribution = List.of(
                new RiskLevelBucket("HIGH", high),
                new RiskLevelBucket("MEDIUM", medium),
                new RiskLevelBucket("LOW", low));

        double avgScore = atRisk.isEmpty() ? 0
                : round1(atRisk.stream().mapToInt(AtRiskLearner::riskScore).average().orElse(0));

        return new ActivityResponse(courseId, course.getName(), threshold, computation.totalLearners,
                computation.completed, computation.active, computation.inactive, computation.neverStarted,
                computation.notCompleted, atRisk.size(), high, medium, low, avgScore,
                computation.progressDistribution, riskDistribution, top);
    }

    /**
     * Tính toàn bộ chỉ số hoạt động + rủi ro cho một khóa học.
     *
     * <p>Quy tắc quan trọng:
     * <ul>
     *   <li>Học viên đã hoàn thành khóa học KHÔNG bao giờ nằm trong nhóm nguy cơ.</li>
     *   <li>Học viên chưa từng mở bài học nào (lastAccessedAt = null, 0 bài hoàn thành)
     *       được tính riêng là {@code neverStarted}, không tính là active.</li>
     *   <li>Học viên đang học bình thường (truy cập gần đây, chưa hoàn thành) là active,
     *       dù điểm rủi ro có thể khác 0 do tiến độ thấp / điểm thi thấp.</li>
     * </ul>
     */
    private ActivityComputation computeActivity(Long courseId, int threshold) {
        List<LearnerRisk> risks = computeLearnerRisks(courseId, threshold);

        long completed = 0, active = 0, inactive = 0, neverStarted = 0, notCompleted = 0;
        long high = 0, medium = 0, low = 0;
        long[] dist = new long[6];
        List<AtRiskLearner> atRisk = new ArrayList<>();

        for (LearnerRisk r : risks) {
            dist[distributionIndex(r.progressPercentage())]++;

            if (r.completed()) {
                completed++;
                continue;
            }
            notCompleted++;

            if (r.neverStarted()) {
                neverStarted++;
            } else if (r.idleDays() >= threshold) {
                inactive++;
            } else {
                active++;
            }

            if ("HIGH".equals(r.riskLevel())) {
                high++;
            } else if ("MEDIUM".equals(r.riskLevel())) {
                medium++;
            } else {
                low++;
            }

            // Chỉ đưa vào nhóm nguy cơ khi điểm rủi ro >= MEDIUM.
            if ("HIGH".equals(r.riskLevel()) || "MEDIUM".equals(r.riskLevel())) {
                atRisk.add(new AtRiskLearner(
                        r.enrollmentId(), r.userId(), r.studentName(), r.studentEmail(),
                        r.departmentName(), r.progressPercentage(),
                        r.enrolledAt(), r.lastAccessedAt(), r.idleDays(),
                        r.neverStarted() ? "NEVER_STARTED" : "INACTIVE",
                        r.riskLevel(), r.riskScore(), r.factors(), r.primaryReason(),
                        r.studySeconds(), r.examScorePercent()));
            }
        }

        List<ProgressBucket> progressDistribution = List.of(
                new ProgressBucket("0%", dist[0]),
                new ProgressBucket("1-25%", dist[1]),
                new ProgressBucket("26-50%", dist[2]),
                new ProgressBucket("51-75%", dist[3]),
                new ProgressBucket("76-99%", dist[4]),
                new ProgressBucket("100%", dist[5]));

        return new ActivityComputation(
                risks.size(), completed, active, inactive, neverStarted, notCompleted,
                high, medium, low, progressDistribution, atRisk);
    }

    /**
     * Chấm điểm rủi ro cho toàn bộ học viên trong phạm vi.
     *
     * @param courseId null = toàn hệ thống, ngược lại chỉ một khóa học
     * @param threshold ngưỡng không hoạt động (ngày)
     */
    private List<LearnerRisk> computeLearnerRisks(Long courseId, int threshold) {
        List<CourseEnrollment> enrollments = courseId == null
                ? analyticsRepository.findActiveEnrollmentsWithUserScope(null)
                : analyticsRepository.findActiveEnrollmentsWithUser(courseId);

        // Số bài học + tổng thời lượng của từng khóa (tiến độ tính theo khóa của học viên).
        Map<Long, Long> lessonCountByCourse = new HashMap<>();
        Map<Long, Long> durationByCourse = new HashMap<>();
        for (CourseEnrollment e : enrollments) {
            Long cid = e.getCourse().getId();
            if (!lessonCountByCourse.containsKey(cid)) {
                lessonCountByCourse.put(cid, analyticsRepository.countActiveLessons(cid));
                Long dur = analyticsRepository.sumActiveLessonDurations(cid);
                durationByCourse.put(cid, dur == null ? 0L : dur);
            }
        }

        Map<Long, long[]> studyByEnrollment = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateLessonProgressByEnrollment(courseId)) {
            studyByEnrollment.put((Long) row[0], new long[]{
                    row[2] == null ? 0L : ((Number) row[2]).longValue(),
                    ((Number) row[3]).longValue()
            });
        }

        Map<Long, Double> examByUser = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateExamScoresByStudent(courseId)) {
            examByUser.put((Long) row[0], ((Number) row[1]).doubleValue());
        }

        Map<Long, String> departmentByEnrollment = departmentNamesByEnrollmentScope(courseId);

        LocalDateTime now = LocalDateTime.now();
        List<LearnerRisk> result = new ArrayList<>();

        for (CourseEnrollment e : enrollments) {
            Long cid = e.getCourse().getId();
            long lessonCount = lessonCountByCourse.getOrDefault(cid, 0L);
            long[] study = studyByEnrollment.getOrDefault(e.getId(), new long[]{0L, 0L});
            long done = study[0];
            long studySeconds = study[1];

            int pct = lessonCount == 0 ? 0 : (int) Math.round(done * 100.0 / lessonCount);
            boolean completed = lessonCount > 0 && pct >= 100;

            boolean never = e.getLastAccessedAt() == null && done == 0;
            LocalDateTime reference = e.getLastAccessedAt() != null
                    ? e.getLastAccessedAt()
                    : (e.getCreatedAt() != null ? e.getCreatedAt() : now);
            long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));

            User u = e.getUser();
            Double examScore = u == null ? null : examByUser.get(u.getId());
            long expectedStudy = DropoutRiskScorer.expectedStudySeconds(
                    pct, durationByCourse.getOrDefault(cid, 0L));

            DropoutRiskScorer.Result risk = DropoutRiskScorer.score(new DropoutRiskScorer.Input(
                    pct, idleDays, threshold, examScore, studySeconds, expectedStudy,
                    completed, never));

            result.add(new LearnerRisk(
                    e.getId(),
                    u == null ? null : u.getId(),
                    u == null ? null : u.getFullName(),
                    u == null ? null : u.getEmail(),
                    departmentByEnrollment.get(e.getId()),
                    pct, idleDays, studySeconds, examScore, never, completed,
                    e.getCreatedAt(), e.getLastAccessedAt(),
                    risk.score(), risk.level(), risk.factors(), risk.primaryReason()));
        }
        return result;
    }

    /** Kết quả trung gian của việc tính hoạt động + rủi ro. */
    private record ActivityComputation(
            long totalLearners,
            long completed,
            long active,
            long inactive,
            long neverStarted,
            long notCompleted,
            long highRisk,
            long mediumRisk,
            long lowRisk,
            List<ProgressBucket> progressDistribution,
            List<AtRiskLearner> atRisk
    ) {
    }

    /** Hồ sơ rủi ro của một học viên (dùng nội bộ). */
    private record LearnerRisk(
            Long enrollmentId,
            Long userId,
            String studentName,
            String studentEmail,
            String departmentName,
            int progressPercentage,
            long idleDays,
            long studySeconds,
            Double examScorePercent,
            boolean neverStarted,
            boolean completed,
            LocalDateTime enrolledAt,
            LocalDateTime lastAccessedAt,
            int riskScore,
            String riskLevel,
            List<RiskFactor> factors,
            String primaryReason
    ) {
    }

    private static int distributionIndex(int pct) {
        if (pct <= 0) return 0;
        if (pct <= 25) return 1;
        if (pct <= 50) return 2;
        if (pct <= 75) return 3;
        if (pct < 100) return 4;
        return 5;
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
     * Phân tích hiệu quả đào tạo theo phòng ban.
     *
     * <p>Phạm vi:
     * <ul>
     *   <li>Admin xem được toàn hệ thống (bỏ {@code courseId}).</li>
     *   <li>Giảng viên chỉ xem được phòng ban của các khóa học mình có quyền truy cập
     *       — buộc phải truyền {@code courseId} thuộc khóa của mình.</li>
     * </ul>
     */
    public DepartmentAnalyticsResponse getDepartmentAnalytics(Long courseId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = isAdmin(auth);

        // Không phải admin thì bắt buộc phải có courseId (và phải truy cập được khóa đó).
        if (!admin && courseId == null) {
            throw new AccessDeniedException(
                    "Only administrators can view department analytics across all courses");
        }

        String scopeName;
        List<Object[]> rows;
        Map<Long, Long> examGraded = new HashMap<>();
        Map<Long, Double> examAvg = new HashMap<>();
        Map<Long, Long> studySecondsByDept = new HashMap<>();

        if (courseId != null) {
            Course course = requireAccessibleCourse(courseId);
            scopeName = course.getName();
            rows = analyticsRepository.findDepartmentEnrollmentsWithProgressByCourse(courseId);
            for (Object[] row : analyticsRepository.aggregateExamScoresByDepartment(courseId)) {
                examGraded.put(departmentKey(row[0]), ((Number) row[2]).longValue());
                examAvg.put(departmentKey(row[0]), ((Number) row[1]).doubleValue());
            }
            for (Object[] row : analyticsRepository.aggregateStudySecondsByDepartment(courseId)) {
                studySecondsByDept.put(departmentKey(row[0]), ((Number) row[1]).longValue());
            }
        } else {
            scopeName = "Toàn hệ thống";
            rows = analyticsRepository.findDepartmentEnrollmentsWithProgress();
            for (Object[] row : analyticsRepository.aggregateExamScoresByDepartment(null)) {
                examGraded.put(departmentKey(row[0]), ((Number) row[2]).longValue());
                examAvg.put(departmentKey(row[0]), ((Number) row[1]).doubleValue());
            }
            for (Object[] row : analyticsRepository.aggregateStudySecondsByDepartment(null)) {
                studySecondsByDept.put(departmentKey(row[0]), ((Number) row[1]).longValue());
            }
        }

        // Gom enrollment theo phòng ban.
        Map<Long, DepartmentAccumulator> acc = new LinkedHashMap<>();
        // Một học viên thuộc nhiều phòng ban xuất hiện ở nhiều dòng -> đếm distinct cho tổng.
        Set<Long> distinctEnrollmentIds = new HashSet<>();
        for (Object[] row : rows) {
            boolean unassigned = row[0] == null;
            Long deptId = departmentKey(row[0]);
            String deptCode = unassigned ? UNASSIGNED_DEPARTMENT_CODE : (String) row[1];
            String deptName = unassigned ? UNASSIGNED_DEPARTMENT_NAME : (String) row[2];
            DepartmentAccumulator item = acc.computeIfAbsent(deptId,
                    id -> new DepartmentAccumulator(id, deptCode, deptName));
            distinctEnrollmentIds.add((Long) row[3]);

            Long courseOfEnrollment = (Long) row[4];
            long completedLessons = ((Number) row[5]).longValue();
            LocalDateTime lastAccessed = (LocalDateTime) row[6];
            Long userId = (Long) row[7];
            LocalDateTime createdAt = (LocalDateTime) row[8];

            item.learnerCount++;
            item.enrollments.add(new DepartmentEnrollment(
                    (Long) row[3], courseOfEnrollment, completedLessons, lastAccessed, userId, createdAt));
        }

        // Số bài học của từng khóa để tính % hoàn thành chính xác.
        Map<Long, Long> lessonCountByCourse = new HashMap<>();
        for (DepartmentAccumulator item : acc.values()) {
            for (DepartmentEnrollment enrollment : item.enrollments) {
                lessonCountByCourse.computeIfAbsent(enrollment.courseId(),
                        id -> analyticsRepository.countActiveLessons(id));
            }
        }

        // Thời gian học và điểm thi để chấm điểm rủi ro cho từng enrollment.
        Map<Long, long[]> studyByEnrollment = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateStudyAndProgressAllEnrollments(courseId)) {
            studyByEnrollment.put((Long) row[0], new long[]{
                    ((Number) row[1]).longValue(),
                    row[2] == null ? 0L : ((Number) row[2]).longValue()
            });
        }
        Map<Long, Double> examByUser = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateExamScoresByStudent(courseId)) {
            examByUser.put((Long) row[0], ((Number) row[1]).doubleValue());
        }
        Map<Long, Long> courseDurationByCourse = new HashMap<>();
        for (Long cid : lessonCountByCourse.keySet()) {
            Long dur = analyticsRepository.sumActiveLessonDurations(cid);
            courseDurationByCourse.put(cid, dur == null ? 0L : dur);
        }

        LocalDateTime now = LocalDateTime.now();
        List<DepartmentAnalyticsItem> items = new ArrayList<>();
        long totalLearners = distinctEnrollmentIds.size();

        for (DepartmentAccumulator item : acc.values()) {
            long learnerCount = item.learnerCount;

            long completed = 0;
            long active = 0;
            long neverStarted = 0;
            long atRisk = 0;
            long dropped = 0;
            double progressSum = 0;

            for (DepartmentEnrollment enrollment : item.enrollments) {
                long lessonCount = lessonCountByCourse.getOrDefault(enrollment.courseId(), 0L);
                long done = enrollment.completedLessons();
                double progress = lessonCount == 0 ? 0
                        : Math.min(100, done * 100.0 / lessonCount);
                progressSum += progress;

                // Đã hoàn thành khóa học -> không tính vào active / nguy cơ / bỏ học.
                if (lessonCount > 0 && done >= lessonCount) {
                    completed++;
                    continue;
                }

                long[] study = studyByEnrollment.getOrDefault(enrollment.enrollmentId(), new long[]{0L, 0L});
                long studySeconds = study[0];

                boolean never = enrollment.lastAccessedAt() == null && done == 0;
                LocalDateTime reference = enrollment.lastAccessedAt() != null
                        ? enrollment.lastAccessedAt()
                        : (enrollment.createdAt() != null ? enrollment.createdAt() : now);
                long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));

                if (never) {
                    neverStarted++;
                } else if (idleDays < DEFAULT_INACTIVE_DAYS) {
                    active++;
                }

                // Bỏ học thực sự: chưa hoàn thành VÀ không hoạt động >= ngưỡng.
                if (idleDays >= DEFAULT_INACTIVE_DAYS) {
                    dropped++;
                }

                Long userId = enrollment.userId();
                Double examScore = userId == null ? null : examByUser.get(userId);
                long totalCourseSeconds = courseDurationByCourse.getOrDefault(enrollment.courseId(), 0L);
                long expectedStudy = DropoutRiskScorer.expectedStudySeconds(progress, totalCourseSeconds);

                DropoutRiskScorer.Result risk = DropoutRiskScorer.score(new DropoutRiskScorer.Input(
                        progress, idleDays, DEFAULT_INACTIVE_DAYS, examScore, studySeconds, expectedStudy,
                        false, never));

                if ("HIGH".equals(risk.level()) || "MEDIUM".equals(risk.level())) {
                    atRisk++;
                }
            }

            double completionRate = learnerCount == 0 ? 0 : round1(completed * 100.0 / learnerCount);
            double avgProgress = learnerCount == 0 ? 0 : round1(progressSum / learnerCount);
            Long graded = examGraded.get(item.id);
            long studySeconds = studySecondsByDept.getOrDefault(item.id, 0L);

            items.add(new DepartmentAnalyticsItem(
                    item.id, item.code, item.name,
                    learnerCount, completed, completionRate, avgProgress,
                    graded == null ? null : round2(examAvg.get(item.id)),
                    graded == null ? 0 : graded,
                    active, neverStarted, atRisk,
                    round1(100 - completionRate),
                    learnerCount == 0 ? 0 : round1(dropped * 100.0 / learnerCount),
                    studySeconds,
                    round2(studySeconds / 3600.0),
                    learnerCount == 0 ? 0 : round2(studySeconds / 3600.0 / learnerCount)));
        }

        items.sort(Comparator.comparingDouble(DepartmentAnalyticsItem::completionRate).reversed()
                .thenComparing(Comparator.comparingLong(DepartmentAnalyticsItem::learnerCount).reversed())
                .thenComparing(d -> d.departmentName(), Comparator.nullsLast(String::compareToIgnoreCase)));

        // Nhóm "chưa phân phòng ban" không tham gia so sánh tốt nhất / kém nhất.
        List<DepartmentAnalyticsItem> comparable = items.stream()
                .filter(i -> !Objects.equals(i.departmentId(), UNASSIGNED_DEPARTMENT_ID))
                .toList();
        DepartmentAnalyticsItem best = comparable.isEmpty() ? null : comparable.get(0);
        DepartmentAnalyticsItem worst = comparable.size() < 2 ? null
                : comparable.stream().min(Comparator.comparingDouble(DepartmentAnalyticsItem::completionRate)
                .thenComparing(Comparator.comparingLong(DepartmentAnalyticsItem::learnerCount).reversed())).orElse(null);

        // Tính từ enrollment distinct để không cộng trùng giờ học của người thuộc nhiều phòng ban.
        long totalStudySeconds = distinctEnrollmentIds.stream()
                .mapToLong(id -> studyByEnrollment.getOrDefault(id, new long[]{0L, 0L})[0])
                .sum();
        double totalStudyHours = totalStudySeconds / 3600.0;

        return new DepartmentAnalyticsResponse(courseId, scopeName, totalLearners,
                items.size(), round2(totalStudyHours), best, worst, items);
    }

    /** Id phòng ban dùng làm key; null (học viên chưa có phòng ban) -> nhóm "Chưa phân phòng ban". */
    private static Long departmentKey(Object rawId) {
        return rawId == null ? UNASSIGNED_DEPARTMENT_ID : (Long) rawId;
    }

    /** Enrollment của một học viên trong phòng ban (dùng để tính tiến độ). */
    private record DepartmentEnrollment(
            Long enrollmentId,
            Long courseId,
            long completedLessons,
            LocalDateTime lastAccessedAt,
            Long userId,
            LocalDateTime createdAt
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

        // Gom so lieu theo khoa hoc.
        Map<Long, Long> learnersByCourse = new HashMap<>();
        Map<Long, Long> completedByCourse = new HashMap<>();
        Map<Long, Long> inactiveByCourse = new HashMap<>();
        Map<Long, Long> activeByCourse = new HashMap<>();
        Map<Long, Long> neverStartedByCourse = new HashMap<>();
        /** So hoc vien thuc su bo hoc: chua hoan thanh VA khong hoat dong >= nguong (ke ca nguoi chua tung hoc). */
        Map<Long, Long> droppedByCourse = new HashMap<>();

        List<Object[]> progressRows = analyticsRepository.findEnrollmentsWithCompletedLessons();
        for (Object[] row : progressRows) {
            Long courseId = (Long) row[0];
            Long enrollmentId = (Long) row[1];
            long done = ((Number) row[2]).longValue();
            learnersByCourse.merge(courseId, 1L, Long::sum);

            long threshold = lessonCountByCourse.getOrDefault(courseId, 0L);
            if (threshold > 0 && done >= threshold) {
                completedByCourse.merge(courseId, 1L, Long::sum);
            }
        }

        LocalDateTime now = LocalDateTime.now();
        for (Object[] row : analyticsRepository.findEnrollmentActivityDetail()) {
            Long courseId = (Long) row[0];
            Long enrollmentId = (Long) row[1];
            LocalDateTime lastAccessed = (LocalDateTime) row[2];
            LocalDateTime createdAt = (LocalDateTime) row[3];
            long done = ((Number) row[4]).longValue();

            // Da hoan thanh khoa hoc -> khong tinh vao active/inactive/bo hoc.
            long threshold = lessonCountByCourse.getOrDefault(courseId, 0L);
            boolean completed = threshold > 0 && done >= threshold;
            if (completed) {
                continue;
            }

            // Phan biet ro 3 nhom:
            // - never started: chua tung mo bai hoc nao (khong co progress va khong truy cap).
            // - active: da hoc va truy cap gan day.
            // - inactive: da hoc nhung lau khong truy cap.
            boolean neverStarted = lastAccessed == null && done == 0;
            LocalDateTime reference = lastAccessed != null
                    ? lastAccessed
                    : (createdAt != null ? createdAt : now);
            long idleDays = Math.max(0, ChronoUnit.DAYS.between(reference, now));

            if (neverStarted) {
                neverStartedByCourse.merge(courseId, 1L, Long::sum);
                // Học viên mới đăng ký chưa kịp học KHÔNG bị tính là bỏ học:
                // chỉ tính khi đã qua ngưỡng không hoạt động (cùng quy tắc với Activity / Department).
                if (idleDays >= DEFAULT_INACTIVE_DAYS) {
                    droppedByCourse.merge(courseId, 1L, Long::sum);
                }
                continue;
            }

            if (idleDays >= DEFAULT_INACTIVE_DAYS) {
                inactiveByCourse.merge(courseId, 1L, Long::sum);
                droppedByCourse.merge(courseId, 1L, Long::sum);
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
            long neverStarted = neverStartedByCourse.getOrDefault(courseId, 0L);
            long dropped = droppedByCourse.getOrDefault(courseId, 0L);
            double[] rating = ratingStats.get(courseId);

            double completionRate = learners == 0 ? 0 : round1(completed * 100.0 / learners);
            long notCompleted = Math.max(0, learners - completed);
            double notCompletedRate = learners == 0 ? 0 : round1(notCompleted * 100.0 / learners);
            // Ty le bo hoc thuc su: da bo hoc (inactive + never started) / tong hoc vien.
            double dropOffRate = learners == 0 ? 0 : round1(dropped * 100.0 / learners);

            all.add(new CourseRankingItem(
                    0, courseId, course.getName(), course.getInstructor(),
                    learners, completed, completionRate,
                    rating == null ? 0 : round2(rating[0]),
                    rating == null ? 0 : (long) rating[1],
                    active, inactive, neverStarted, notCompleted, notCompletedRate, dropOffRate));
        }

        all.sort(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()
                .thenComparing(c -> c.courseName(), Comparator.nullsLast(String::compareToIgnoreCase)));

        List<CourseRankingItem> topByLearners = ranked(all);

        List<CourseRankingItem> byCompletion = new ArrayList<>(all);
        byCompletion.sort(Comparator.comparingDouble(CourseRankingItem::completionRate).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()));
        List<CourseRankingItem> topByCompletion = ranked(byCompletion);

        List<CourseRankingItem> byRating = new ArrayList<>(all);
        byRating.sort(Comparator.comparingDouble(CourseRankingItem::averageRating).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::totalReviews).reversed()));
        List<CourseRankingItem> topByRating = ranked(byRating);

        List<CourseRankingItem> byDropOff = new ArrayList<>(all);
        byDropOff.sort(Comparator.comparingDouble(CourseRankingItem::dropOffRate).reversed()
                .thenComparing(Comparator.comparingLong(CourseRankingItem::learnerCount).reversed()));
        List<CourseRankingItem> highestDropOff = ranked(byDropOff);

        return new CourseRankingResponse(courses.size(), topByLearners, topByCompletion,
                topByRating, highestDropOff, ranked(all));
    }

    /** Gan lai thu hang 1..n cho danh sach da sap xep san. */
    private static List<CourseRankingItem> ranked(List<CourseRankingItem> items) {
        List<CourseRankingItem> result = new ArrayList<>();
        int rank = 1;
        for (CourseRankingItem item : items) {
            result.add(new CourseRankingItem(rank++, item.courseId(), item.courseName(), item.instructor(),
                    item.learnerCount(), item.completedLearners(), item.completionRate(),
                    item.averageRating(), item.totalReviews(), item.activeLearners(),
                    item.inactiveLearners(), item.neverStartedLearners(), item.notCompletedLearners(),
                    item.notCompletedRate(), item.dropOffRate()));
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
    // 9. Thời gian học (study time)
    // =====================================================================

    /**
     * Thời gian học của từng học viên trong một khóa học.
     *
     * <p>Thời gian học được tích luỹ theo từng bài học (xem
     * {@code LessonProgress.studySeconds}), nên đây là tổng thời gian học viên
     * thực sự dành cho nội dung của khóa học.
     */
    public StudyTimeResponse getStudyTime(Long courseId) {
        Course course = requireAccessibleCourse(courseId);

        int totalLessons = lessonRepository.findActiveByCourseIdOrdered(courseId).size();

        // Phòng ban chính của từng học viên (để hiển thị trong bảng).
        Map<Long, String> departmentByEnrollment = departmentNamesByEnrollment(courseId);

        List<StudentStudyTimeItem> items = new ArrayList<>();
        long totalStudySeconds = 0;

        for (Object[] row : analyticsRepository.findStudyTimeByLearner(courseId)) {
            Long enrollmentId = (Long) row[0];
            Long userId = (Long) row[1];
            String fullName = (String) row[2];
            String email = (String) row[3];
            long studySeconds = ((Number) row[4]).longValue();
            long completedLessons = ((Number) row[5]).longValue();
            LocalDateTime lastAccessed = (LocalDateTime) row[6];

            totalStudySeconds += studySeconds;

            items.add(new StudentStudyTimeItem(
                    enrollmentId,
                    userId,
                    fullName,
                    email,
                    departmentByEnrollment.get(enrollmentId),
                    studySeconds,
                    round2(studySeconds / 3600.0),
                    (int) completedLessons,
                    totalLessons,
                    totalLessons == 0 ? 0 : round1(completedLessons * 100.0 / totalLessons),
                    lastAccessed));
        }

        items.sort(Comparator.comparingLong(StudentStudyTimeItem::studySeconds).reversed()
                .thenComparing(i -> i.studentName() == null ? "" : i.studentName(),
                        Comparator.nullsLast(String::compareToIgnoreCase)));

        StudentStudyTimeItem top = items.isEmpty() ? null : items.get(0);
        double average = items.isEmpty() ? 0 : round2(totalStudySeconds / 3600.0 / items.size());

        return new StudyTimeResponse(
                courseId,
                course.getName(),
                totalStudySeconds,
                round2(totalStudySeconds / 3600.0),
                items.size(),
                average,
                top,
                items);
    }

    /**
     * Map enrollmentId -> tên phòng ban chính, dùng để gắn phòng ban cho từng học viên.
     */
    private Map<Long, String> departmentNamesByEnrollment(Long courseId) {
        return departmentNamesByEnrollmentScope(courseId);
    }

    /** Như trên nhưng hỗ trợ cả phạm vi toàn hệ thống (courseId null). */
    private Map<Long, String> departmentNamesByEnrollmentScope(Long courseId) {
        Map<Long, String> result = new HashMap<>();
        for (CourseEnrollment enrollment : analyticsRepository.findActiveEnrollmentsWithUserScope(courseId)) {
            User user = enrollment.getUser();
            if (user == null) {
                continue;
            }
            String name = user.getDepartments().stream()
                    .filter(java.util.Objects::nonNull)
                    .map(Department::getName)
                    .filter(java.util.Objects::nonNull)
                    .sorted()
                    .findFirst()
                    .orElse(null);
            result.put(enrollment.getId(), name);
        }
        return result;
    }

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
