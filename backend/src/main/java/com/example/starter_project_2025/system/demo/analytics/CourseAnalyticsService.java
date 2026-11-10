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
