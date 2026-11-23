package com.example.starter_project_2025.system.demo.analytics;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.analytics.CourseAnalyticsService.LearnerRisk;
import com.example.starter_project_2025.system.demo.analytics.LearnerEngagementDTO.*;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.department.Department;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.report.CourseReportRepository;
import com.example.starter_project_2025.system.notification.Notification;
import com.example.starter_project_2025.system.notification.NotificationRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Các chức năng mở rộng của Course Analytics:
 * <ul>
 *   <li>Điểm nghẽn / nơi người học bỏ học theo từng bài</li>
 *   <li>Danh sách người học có vấn đề + gửi thông báo nhắc học (kiểu Duolingo)</li>
 *   <li>Top người học chăm nhất theo phòng ban / toàn hệ thống</li>
 * </ul>
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class LearnerEngagementService {

    static final String NUDGE_KEY_PREFIX = "learning-nudge:";

    private static final int DEFAULT_INACTIVE_DAYS = DropoutRiskScorer.DEFAULT_INACTIVE_DAYS;
    private static final int MAX_BOTTLENECKS = 5;
    private static final int DEFAULT_LIMIT = 10;
    private static final int MAX_LIMIT = 100;
    private static final double LOW_EXAM_THRESHOLD = 50.0;

    static final String P_NEVER_STARTED = "NEVER_STARTED";
    static final String P_DROPPED_OUT = "DROPPED_OUT";
    static final String P_INACTIVE = "INACTIVE";
    static final String P_LOW_EXAM = "LOW_EXAM_SCORE";
    private static final List<String> PROBLEM_TYPES =
            List.of(P_DROPPED_OUT, P_NEVER_STARTED, P_INACTIVE, P_LOW_EXAM);

    private static final long UNASSIGNED_DEPARTMENT_ID = -1L;
    private static final String UNASSIGNED_DEPARTMENT_CODE = "UNASSIGNED";
    private static final String UNASSIGNED_DEPARTMENT_NAME = "Chưa phân phòng ban";

    private final CourseAnalyticsService analyticsService;
    private final CourseAnalyticsRepository analyticsRepository;
    private final LessonRepository lessonRepository;
    private final CourseReportRepository courseReportRepository;
    private final NotificationService notificationService;
    private final NotificationRepository notificationRepository;

    /** Số ngày tối thiểu giữa 2 lần nhắc học cùng một người trong cùng một khóa. */
    @Value("${app.learning-nudge.cooldown-days:3}")
    private int cooldownDays;

    // =====================================================================
    // 1. Bottlenecks
    // =====================================================================

    public BottleneckResponse getBottlenecks(Long courseId, Integer inactiveDays) {
        Course course = analyticsService.requireAccessibleCourse(courseId);
        int threshold = resolveThreshold(inactiveDays);

        List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(courseId);
        List<LearnerRisk> risks = analyticsService.computeLearnerRisks(courseId, threshold);
        long totalLearners = risks.size();

        Map<Long, Integer> positionByLesson = positions(lessons);
        ProgressIndex index = indexProgress(courseId, positionByLesson);

        Map<Long, Long> reportsByLesson = new HashMap<>();
        for (Object[] row : analyticsRepository.countReportsByLesson(courseId)) {
            reportsByLesson.put((Long) row[0], ((Number) row[1]).longValue());
        }

        // Học viên bỏ học = chưa hoàn thành + không hoạt động >= ngưỡng.
        long dropped = 0;
        long neverStartedDropouts = 0;
        Map<Long, Long> dropoutByLesson = new HashMap<>();
        for (LearnerRisk r : risks) {
            if (r.completed() || r.idleDays() < threshold) {
                continue;
            }
            dropped++;
            if (r.neverStarted()) {
                neverStartedDropouts++;
                continue;
            }
            Long lastLessonId = index.lastLessonByEnrollment.get(r.enrollmentId());
            if (lastLessonId != null) {
                dropoutByLesson.merge(lastLessonId, 1L, Long::sum);
            }
        }

        List<LessonBottleneckItem> items = new ArrayList<>();
        double previousRate = 0;
        int position = 0;
        for (Lesson lesson : lessons) {
            position++;
            long[] stats = index.statsByLesson.getOrDefault(lesson.getId(), new long[3]);
            long started = stats[0];
            long completed = stats[1];
            long studySum = stats[2];

            double rate = totalLearners == 0 ? 0 : CourseAnalyticsService.round1(completed * 100.0 / totalLearners);
            double dropOff = position == 1 ? 0 : CourseAnalyticsService.round1(Math.max(0, previousRate - rate));
            previousRate = rate;

            long stuck = Math.max(0, started - completed);
            double stuckRate = started == 0 ? 0 : CourseAnalyticsService.round1(stuck * 100.0 / started);
            long dropout = dropoutByLesson.getOrDefault(lesson.getId(), 0L);
            double dropoutRate = totalLearners == 0 ? 0 : CourseAnalyticsService.round1(dropout * 100.0 / totalLearners);
            long avgStudy = started == 0 ? 0 : Math.round(studySum / (double) started);
            long expected = lesson.getDuration() == null ? 0L : Math.max(0, lesson.getDuration());
            Double timeRatio = expected > 0 && started > 0
                    ? Math.round(avgStudy * 100.0 / expected) / 100.0 : null;
            long reports = reportsByLesson.getOrDefault(lesson.getId(), 0L);

            List<String> reasons = new ArrayList<>();
            double score = 0;
            if (dropOff >= 10) {
                reasons.add("HIGH_DROP_OFF");
            }
            score += Math.min(35, dropOff * 35.0 / 30.0);
            if (dropout > 0 && dropoutRate >= 5) {
                reasons.add("HIGH_DROPOUT");
            }
            score += Math.min(30, dropoutRate * 3);
            if (started >= 3 && stuckRate >= 40) {
                reasons.add("MANY_STUCK");
            }
            if (started >= 3) {
                score += Math.min(20, stuckRate / 50.0 * 20);
            }
            if (timeRatio != null && timeRatio >= 1.5) {
                reasons.add("SLOW_COMPLETION");
                score += Math.min(10, (timeRatio - 1) * 10);
            }
            if (reports > 0) {
                reasons.add("REPORTED");
                score += Math.min(5, reports * 2.0);
            }
            int finalScore = (int) Math.round(Math.min(100, score));
            String severity = reasons.isEmpty() ? "NONE"
                    : finalScore >= 40 ? "HIGH" : finalScore >= 20 ? "MEDIUM" : "NONE";

            items.add(new LessonBottleneckItem(
                    lesson.getId(), lesson.getTitle(),
                    lesson.getContentType() == null ? null : lesson.getContentType().name(),
                    lesson.getSection().getId(), lesson.getSection().getTitle(),
                    position, started, completed, rate, dropOff,
                    stuck, stuckRate, dropout, dropoutRate,
                    avgStudy, expected, timeRatio, reports,
                    finalScore, severity, List.copyOf(reasons)));
        }

        List<LessonBottleneckItem> bottlenecks = items.stream()
                .filter(i -> !"NONE".equals(i.severity()))
                .sorted(Comparator.comparingInt(LessonBottleneckItem::bottleneckScore).reversed())
                .limit(MAX_BOTTLENECKS)
                .toList();
        LessonBottleneckItem topDropout = items.stream()
                .filter(i -> i.dropoutCount() > 0)
                .max(Comparator.comparingLong(LessonBottleneckItem::dropoutCount))
                .orElse(null);

        return new BottleneckResponse(courseId, course.getName(), threshold, totalLearners,
                dropped, neverStartedDropouts, topDropout, bottlenecks, sections(items, totalLearners), items);
    }

    private static List<SectionBottleneckItem> sections(List<LessonBottleneckItem> items, long totalLearners) {
        Map<Long, List<LessonBottleneckItem>> bySection = new LinkedHashMap<>();
        for (LessonBottleneckItem item : items) {
            bySection.computeIfAbsent(item.sectionId(), id -> new ArrayList<>()).add(item);
        }
        List<SectionBottleneckItem> result = new ArrayList<>();
        for (List<LessonBottleneckItem> group : bySection.values()) {
            long dropout = group.stream().mapToLong(LessonBottleneckItem::dropoutCount).sum();
            double avgCompletion = group.stream().mapToDouble(LessonBottleneckItem::completionRate).average().orElse(0);
            result.add(new SectionBottleneckItem(
                    group.get(0).sectionId(), group.get(0).sectionTitle(), group.size(),
                    CourseAnalyticsService.round1(avgCompletion), dropout,
                    totalLearners == 0 ? 0 : CourseAnalyticsService.round1(dropout * 100.0 / totalLearners)));
        }
        return result;
    }

    // =====================================================================
    // 2. Problem learners + nudges
    // =====================================================================

    public ProblemLearnersResponse getProblemLearners(Long courseId, Integer inactiveDays, String problemType) {
        Course course = analyticsService.requireAccessibleCourse(courseId);
        int threshold = resolveThreshold(inactiveDays);
        String filter = normalizeProblemType(problemType);

        List<LearnerRisk> risks = analyticsService.computeLearnerRisks(courseId, threshold);
        List<ProblemLearner> all = buildProblemLearners(courseId, threshold, risks);

        long never = 0, dropped = 0, inactive = 0, lowExam = 0;
        for (ProblemLearner p : all) {
            if (p.problems().contains(P_NEVER_STARTED)) never++;
            if (p.problems().contains(P_DROPPED_OUT)) dropped++;
            if (p.problems().contains(P_INACTIVE)) inactive++;
            if (p.problems().contains(P_LOW_EXAM)) lowExam++;
        }

        List<ProblemLearner> shown = all.stream()
                .filter(p -> filter == null || p.problems().contains(filter))
                .toList();

        return new ProblemLearnersResponse(courseId, course.getName(), threshold, cooldownDays,
                risks.size(), all.size(), never, dropped, inactive, lowExam, shown);
    }

    /** Gửi thông báo nhắc học (người dùng bấm gửi). */
    @Transactional
    public NudgeResult sendNudges(Long courseId, NudgeRequest request) {
        Course course = analyticsService.requireAccessibleCourse(courseId);
        NudgeRequest req = request == null ? new NudgeRequest(null, null, null) : request;
        int threshold = resolveThreshold(req.inactiveDays());
        String filter = normalizeProblemType(req.problemType());

        List<ProblemLearner> eligible = buildProblemLearners(
                courseId, threshold, analyticsService.computeLearnerRisks(courseId, threshold));

        List<ProblemLearner> targets;
        long notEligible = 0;
        long requested;
        if (req.userIds() != null && !req.userIds().isEmpty()) {
            Set<Long> wanted = new LinkedHashSet<>(req.userIds());
            requested = wanted.size();
            Map<Long, ProblemLearner> byUser = eligible.stream()
                    .collect(Collectors.toMap(ProblemLearner::userId, p -> p, (a, b) -> a));
            targets = new ArrayList<>();
            for (Long userId : wanted) {
                ProblemLearner p = byUser.get(userId);
                if (p == null) {
                    notEligible++;
                } else {
                    targets.add(p);
                }
            }
        } else {
            targets = eligible.stream()
                    .filter(p -> filter == null || p.problems().contains(filter))
                    .toList();
            requested = targets.size();
        }

        return deliver(course, targets, requested, notEligible);
    }

    /**
     * Nhắc học tự động cho toàn bộ khóa đã xuất bản - chỉ nhắc người có rủi ro HIGH
     * và đã qua thời gian cooldown. Được gọi bởi {@link LearningNudgeJob}.
     */
    @Transactional
    public long autoNudgeAllCourses() {
        long total = 0;
        for (Course course : courseReportRepository.findAllCoursesWithMeta()) {
            if (course.getStatus() != CourseStatus.PUBLISHED) {
                continue;
            }
            try {
                List<ProblemLearner> targets = buildProblemLearners(course.getId(), DEFAULT_INACTIVE_DAYS,
                                analyticsService.computeLearnerRisks(course.getId(), DEFAULT_INACTIVE_DAYS))
                        .stream()
                        .filter(p -> "HIGH".equals(p.riskLevel()))
                        .toList();
                total += deliver(course, targets, targets.size(), 0).sent();
            } catch (Exception ex) {
                log.warn("Auto nudge failed for course {}: {}", course.getId(), ex.getMessage());
            }
        }
        return total;
    }

    private NudgeResult deliver(Course course, List<ProblemLearner> targets, long requested, long notEligible) {
        long skippedCooldown = 0;
        List<Long> sent = new ArrayList<>();
        String day = LocalDate.now().toString();
        for (ProblemLearner p : targets) {
            if (!p.canNudge()) {
                skippedCooldown++;
                continue;
            }
            String[] text = buildMessage(course, p);
            String target = "/enrollments/" + p.enrollmentId() + "/learn"
                    + (p.nextLessonId() != null ? "?lessonId=" + p.nextLessonId() : "");
            notificationService.createOnce(
                    p.userId(),
                    NUDGE_KEY_PREFIX + course.getId() + ":" + p.userId() + ":" + day,
                    text[0], text[1], target);
            sent.add(p.userId());
        }
        return new NudgeResult(requested, sent.size(), skippedCooldown, notEligible, sent);
    }

    /** [title, message] - giọng văn khích lệ, cá nhân hóa theo vấn đề chính. */
    private static String[] buildMessage(Course course, ProblemLearner p) {
        String courseName = course.getName();
        String next = p.nextLessonTitle() != null ? p.nextLessonTitle() : "your next lesson";
        String title;
        String message;
        switch (p.primaryProblem()) {
            case P_NEVER_STARTED -> {
                title = "Your course is waiting for you";
                message = "You enrolled in \"" + courseName + "\" but haven't opened a lesson yet. "
                        + "Start with \"" + next + "\" - it only takes a few minutes.";
            }
            case P_LOW_EXAM -> {
                title = "Need a quick refresher?";
                message = "Your recent exam results in \"" + courseName + "\" were below the passing level. "
                        + "Review \"" + (p.lastLessonTitle() != null ? p.lastLessonTitle() : next)
                        + "\" and give it another try.";
            }
            default -> {
                title = "We miss you! Keep your learning going";
                message = "It's been " + p.inactiveDays() + " days since your last visit to \"" + courseName
                        + "\". You're " + p.progressPercentage() + "% done - pick up where you left off with \""
                        + next + "\".";
            }
        }
        return new String[]{truncate(title, 120), truncate(message, 500)};
    }

    private List<ProblemLearner> buildProblemLearners(Long courseId, int threshold, List<LearnerRisk> risks) {
        List<Lesson> lessons = lessonRepository.findActiveByCourseIdOrdered(courseId);
        Map<Long, Lesson> lessonById = lessons.stream()
                .collect(Collectors.toMap(Lesson::getId, l -> l, (a, b) -> a, LinkedHashMap::new));
        ProgressIndex index = indexProgress(courseId, positions(lessons));
        Map<Long, NudgeHistory> history = nudgeHistory(courseId);
        LocalDateTime now = LocalDateTime.now();

        List<ProblemLearner> result = new ArrayList<>();
        for (LearnerRisk r : risks) {
            if (r.completed() || r.userId() == null) {
                continue;
            }
            Set<String> found = new HashSet<>();
            if (r.neverStarted() && r.idleDays() >= threshold) {
                found.add(P_NEVER_STARTED);
            }
            if (!r.neverStarted() && r.idleDays() >= 2L * threshold) {
                found.add(P_DROPPED_OUT);
            } else if (!r.neverStarted() && r.idleDays() >= threshold) {
                found.add(P_INACTIVE);
            }
            if (r.examScorePercent() != null && r.examScorePercent() < LOW_EXAM_THRESHOLD) {
                found.add(P_LOW_EXAM);
            }
            if (found.isEmpty()) {
                continue;
            }
            List<String> problems = PROBLEM_TYPES.stream().filter(found::contains).toList();

            Set<Long> done = index.completedByEnrollment.getOrDefault(r.enrollmentId(), Set.of());
            Lesson next = lessons.stream().filter(l -> !done.contains(l.getId())).findFirst().orElse(null);
            Long lastLessonId = index.lastLessonByEnrollment.get(r.enrollmentId());
            Lesson last = lastLessonId == null ? null : lessonById.get(lastLessonId);

            NudgeHistory h = history.get(r.userId());
            LocalDateTime lastNudged = h == null ? null : h.lastAt;
            boolean canNudge = lastNudged == null || !lastNudged.plusDays(cooldownDays).isAfter(now);

            result.add(new ProblemLearner(
                    r.enrollmentId(), r.userId(), r.studentName(), r.studentEmail(), r.departmentName(),
                    r.progressPercentage(), r.idleDays(), r.enrolledAt(), r.lastAccessedAt(),
                    problems.get(0), problems, r.riskLevel(), r.riskScore(), r.examScorePercent(),
                    last == null ? null : last.getId(), last == null ? null : last.getTitle(),
                    next == null ? null : next.getId(), next == null ? null : next.getTitle(),
                    lastNudged, h == null ? 0 : h.count, canNudge));
        }
        result.sort(Comparator
                .comparingInt(ProblemLearner::riskScore).reversed()
                .thenComparing(Comparator.comparingLong(ProblemLearner::inactiveDays).reversed()));
        return result;
    }

    /** userId -> (số lần đã nhắc, lần nhắc gần nhất) cho một khóa học. */
    private Map<Long, NudgeHistory> nudgeHistory(Long courseId) {
        String prefix = NUDGE_KEY_PREFIX + courseId + ":";
        Map<Long, NudgeHistory> result = new HashMap<>();
        for (Notification n : notificationRepository.findByEventKeyStartingWithOrderByCreatedAtDesc(prefix)) {
            // Key: learning-nudge:{courseId}:{userId}:{yyyy-MM-dd}
            String[] parts = n.getEventKey().split(":");
            if (parts.length < 4) {
                continue;
            }
            try {
                Long userId = Long.valueOf(parts[2]);
                NudgeHistory h = result.computeIfAbsent(userId, id -> new NudgeHistory());
                h.count++;
                if (h.lastAt == null || (n.getCreatedAt() != null && n.getCreatedAt().isAfter(h.lastAt))) {
                    h.lastAt = n.getCreatedAt();
                }
            } catch (NumberFormatException ignored) {
                // key không hợp lệ -> bỏ qua
            }
        }
        return result;
    }

    private static final class NudgeHistory {
        int count;
        LocalDateTime lastAt;
    }

    // =====================================================================
    // 3. Department leaderboard
    // =====================================================================

    public TopLearnersResponse getTopLearners(Long courseId, Integer limit, String sortBy) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean admin = CourseAnalyticsService.isAdmin(auth);
        if (!admin && courseId == null) {
            throw new AccessDeniedException(
                    "Only administrators can view learner rankings across all courses");
        }
        String scopeName = "Toàn hệ thống";
        if (courseId != null) {
            scopeName = analyticsService.requireAccessibleCourse(courseId).getName();
        }

        int top = limit == null ? DEFAULT_LIMIT : limit;
        if (top < 1 || top > MAX_LIMIT) {
            throw new BadRequestException("limit must be between 1 and " + MAX_LIMIT);
        }
        String sort = sortBy == null || sortBy.isBlank() ? "STUDY_TIME" : sortBy.trim().toUpperCase(Locale.ROOT);
        if (!sort.equals("STUDY_TIME") && !sort.equals("LESSONS_COMPLETED")) {
            throw new BadRequestException("sortBy must be STUDY_TIME or LESSONS_COMPLETED");
        }

        List<CourseEnrollment> enrollments = analyticsRepository.findActiveEnrollmentsWithUserScope(courseId);

        // [enrollmentId, đã mở, đã hoàn thành, tổng giây học]
        Map<Long, long[]> progressByEnrollment = new HashMap<>();
        for (Object[] row : analyticsRepository.aggregateLessonProgressByEnrollment(courseId)) {
            progressByEnrollment.put((Long) row[0], new long[]{
                    ((Number) row[1]).longValue(),
                    row[2] == null ? 0L : ((Number) row[2]).longValue(),
                    row[3] == null ? 0L : ((Number) row[3]).longValue()});
        }
        Map<Long, Long> lessonCountByCourse = new HashMap<>();

        Map<Long, LearnerAggregate> byUser = new LinkedHashMap<>();
        for (CourseEnrollment e : enrollments) {
            User user = e.getUser();
            if (user == null) {
                continue;
            }
            LearnerAggregate agg = byUser.computeIfAbsent(user.getId(), id -> new LearnerAggregate(user));
            long[] p = progressByEnrollment.getOrDefault(e.getId(), new long[3]);
            agg.coursesEnrolled++;
            agg.lessonsCompleted += p[1];
            agg.studySeconds += p[2];
            Long cid = e.getCourse().getId();
            long lessonCount = lessonCountByCourse.computeIfAbsent(cid, analyticsRepository::countActiveLessons);
            if (lessonCount > 0 && p[1] >= lessonCount) {
                agg.coursesCompleted++;
            }
            if (e.getLastAccessedAt() != null
                    && (agg.lastAccessedAt == null || e.getLastAccessedAt().isAfter(agg.lastAccessedAt))) {
                agg.lastAccessedAt = e.getLastAccessedAt();
            }
        }

        Comparator<LearnerAggregate> comparator = sort.equals("LESSONS_COMPLETED")
                ? Comparator.comparingLong((LearnerAggregate a) -> a.lessonsCompleted).reversed()
                        .thenComparing(Comparator.comparingLong((LearnerAggregate a) -> a.studySeconds).reversed())
                : Comparator.comparingLong((LearnerAggregate a) -> a.studySeconds).reversed()
                        .thenComparing(Comparator.comparingLong((LearnerAggregate a) -> a.lessonsCompleted).reversed());
        // Ổn định kết quả khi bằng điểm.
        comparator = comparator.thenComparing(a -> a.user.getId());

        List<LearnerAggregate> active = byUser.values().stream()
                .filter(a -> a.studySeconds > 0 || a.lessonsCompleted > 0)
                .sorted(comparator)
                .toList();

        List<TopLearnerItem> systemTop = toItems(active.stream().limit(top).toList(), null);

        // Gom theo phòng ban (một người có thể thuộc nhiều phòng ban).
        Map<Long, DepartmentBucket> buckets = new LinkedHashMap<>();
        for (LearnerAggregate agg : byUser.values()) {
            Set<Department> departments = agg.user.getDepartments();
            if (departments == null || departments.stream().noneMatch(Objects::nonNull)) {
                buckets.computeIfAbsent(UNASSIGNED_DEPARTMENT_ID, id -> new DepartmentBucket(
                        UNASSIGNED_DEPARTMENT_ID, UNASSIGNED_DEPARTMENT_CODE, UNASSIGNED_DEPARTMENT_NAME))
                        .members.add(agg);
                continue;
            }
            for (Department d : departments) {
                if (d == null) {
                    continue;
                }
                buckets.computeIfAbsent(d.getId(), id -> new DepartmentBucket(d.getId(), d.getCode(), d.getName()))
                        .members.add(agg);
            }
        }

        List<DepartmentTopLearners> departmentResults = new ArrayList<>();
        for (DepartmentBucket b : buckets.values()) {
            List<LearnerAggregate> ranked = b.members.stream()
                    .filter(a -> a.studySeconds > 0 || a.lessonsCompleted > 0)
                    .sorted(comparator)
                    .toList();
            double hours = b.members.stream().mapToLong(a -> a.studySeconds).sum() / 3600.0;
            departmentResults.add(new DepartmentTopLearners(
                    b.id, b.code, b.name, b.members.size(), ranked.size(),
                    CourseAnalyticsService.round2(hours),
                    toItems(ranked.stream().limit(top).toList(), b.name)));
        }
        departmentResults.sort(Comparator
                .comparingLong(DepartmentTopLearners::learnerCount).reversed()
                .thenComparing(DepartmentTopLearners::departmentName, Comparator.nullsLast(String::compareTo)));

        return new TopLearnersResponse(courseId, scopeName, top, sort, byUser.size(), systemTop, departmentResults);
    }

    private static List<TopLearnerItem> toItems(List<LearnerAggregate> ranked, String departmentOverride) {
        List<TopLearnerItem> items = new ArrayList<>();
        int rank = 0;
        for (LearnerAggregate a : ranked) {
            rank++;
            String dept = departmentOverride != null ? departmentOverride : primaryDepartment(a.user);
            items.add(new TopLearnerItem(
                    rank, a.user.getId(), a.user.getFullName(), a.user.getEmail(), dept,
                    a.studySeconds, CourseAnalyticsService.round2(a.studySeconds / 3600.0),
                    a.lessonsCompleted, a.coursesEnrolled, a.coursesCompleted, a.lastAccessedAt));
        }
        return items;
    }

    private static String primaryDepartment(User user) {
        if (user.getDepartments() == null) {
            return UNASSIGNED_DEPARTMENT_NAME;
        }
        return user.getDepartments().stream()
                .filter(Objects::nonNull)
                .map(Department::getName)
                .filter(Objects::nonNull)
                .sorted()
                .findFirst()
                .orElse(UNASSIGNED_DEPARTMENT_NAME);
    }

    private static final class LearnerAggregate {
        final User user;
        long studySeconds;
        long lessonsCompleted;
        int coursesEnrolled;
        int coursesCompleted;
        LocalDateTime lastAccessedAt;

        LearnerAggregate(User user) {
            this.user = user;
        }
    }

    private static final class DepartmentBucket {
        final Long id;
        final String code;
        final String name;
        final List<LearnerAggregate> members = new ArrayList<>();

        DepartmentBucket(Long id, String code, String name) {
            this.id = id;
            this.code = code;
            this.name = name;
        }
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    /** Chỉ số tiến độ dựng từ bảng lesson_progress của một khóa học. */
    private static final class ProgressIndex {
        /** lessonId -> [số người đã mở, số người hoàn thành, tổng giây học]. */
        final Map<Long, long[]> statsByLesson = new HashMap<>();
        /** enrollmentId -> các lessonId đã hoàn thành. */
        final Map<Long, Set<Long>> completedByEnrollment = new HashMap<>();
        /** enrollmentId -> bài cuối cùng người học chạm tới. */
        final Map<Long, Long> lastLessonByEnrollment = new HashMap<>();
    }

    private ProgressIndex indexProgress(Long courseId, Map<Long, Integer> positionByLesson) {
        ProgressIndex index = new ProgressIndex();
        Map<Long, LocalDateTime> lastAt = new HashMap<>();
        for (Object[] row : analyticsRepository.findLessonProgressDetail(courseId)) {
            Long enrollmentId = (Long) row[0];
            Long lessonId = (Long) row[1];
            if (!positionByLesson.containsKey(lessonId)) {
                continue; // bài đã bị ẩn / xóa
            }
            boolean done = Boolean.TRUE.equals(row[2]);
            long study = row[3] == null ? 0L : ((Number) row[3]).longValue();
            LocalDateTime at = (LocalDateTime) row[4];

            long[] stats = index.statsByLesson.computeIfAbsent(lessonId, id -> new long[3]);
            stats[0]++;
            if (done) {
                stats[1]++;
                index.completedByEnrollment.computeIfAbsent(enrollmentId, id -> new HashSet<>()).add(lessonId);
            }
            stats[2] += study;

            // Bài cuối = bài có lastAccessedAt mới nhất; bằng nhau thì lấy bài đứng sau.
            Long currentLast = index.lastLessonByEnrollment.get(enrollmentId);
            if (currentLast == null) {
                index.lastLessonByEnrollment.put(enrollmentId, lessonId);
                lastAt.put(enrollmentId, at);
                continue;
            }
            LocalDateTime currentAt = lastAt.get(enrollmentId);
            boolean newer;
            if (at == null && currentAt == null) {
                newer = positionByLesson.get(lessonId) > positionByLesson.get(currentLast);
            } else if (at == null) {
                newer = false;
            } else if (currentAt == null) {
                newer = true;
            } else {
                int cmp = at.compareTo(currentAt);
                newer = cmp > 0 || (cmp == 0 && positionByLesson.get(lessonId) > positionByLesson.get(currentLast));
            }
            if (newer) {
                index.lastLessonByEnrollment.put(enrollmentId, lessonId);
                lastAt.put(enrollmentId, at);
            }
        }
        return index;
    }

    private static Map<Long, Integer> positions(List<Lesson> lessons) {
        Map<Long, Integer> positions = new HashMap<>();
        int position = 0;
        for (Lesson lesson : lessons) {
            positions.put(lesson.getId(), ++position);
        }
        return positions;
    }

    private static int resolveThreshold(Integer inactiveDays) {
        int threshold = inactiveDays == null ? DEFAULT_INACTIVE_DAYS : inactiveDays;
        if (threshold < 1 || threshold > 365) {
            throw new BadRequestException("inactiveDays must be between 1 and 365");
        }
        return threshold;
    }

    private static String normalizeProblemType(String problemType) {
        if (problemType == null || problemType.isBlank() || "ALL".equalsIgnoreCase(problemType)) {
            return null;
        }
        String value = problemType.trim().toUpperCase(Locale.ROOT);
        if (!PROBLEM_TYPES.contains(value)) {
            throw new BadRequestException("problemType must be one of " + PROBLEM_TYPES);
        }
        return value;
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max - 3) + "...";
    }
}
