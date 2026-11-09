package com.example.starter_project_2025.system.analytics.student;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseMyScoresService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class StudentAnalyticsService {
    private static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private final EntityManager em;
    private final CourseMyScoresService scoresService;

    public enum Interval { DAY, WEEK, MONTH }
    public record CourseOption(Long id, String name) {}
    public record Point(String period, long count) {}
    public record RankedStudent(int rank, Long studentId, String name, BigDecimal score, int courseCount) {}
    public record ProgressRow(Long studentId, String name, Long courseId, String courseName,
                              BigDecimal progress, String lastAccessedAt) {}
    public record Bucket(String label, long count) {}
    public record CompletionRate(long completed, long withoutSubmittedExam, BigDecimal percentage) {}
    public record Report(List<CourseOption> courses, List<Point> newStudents, List<Point> activity,
                         List<RankedStudent> topStudents, List<ProgressRow> lowProgress,
                         List<Bucket> enrollmentDistribution, CompletionRate completionRate) {}

    @Transactional(readOnly = true)
    public Report report(UserPrincipal principal, LocalDate from, LocalDate to, Interval interval, Long courseId) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        if (from == null || to == null || from.isAfter(to) || ChronoUnit.DAYS.between(from, to) > 730) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid date range (maximum 731 days)");
        }
        boolean admin = principal.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));
        boolean teacher = principal.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals("ROLE_TEACHER"));
        if (!admin && !teacher) throw new ResponseStatusException(HttpStatus.FORBIDDEN);

        List<Course> courses = admin
                ? em.createQuery("select c from Course c where c.isActive = true order by c.name", Course.class).getResultList()
                : em.createQuery("select c from Course c where c.isActive = true and "
                                + "c.instructorUser.id = :uid order by c.name", Course.class)
                    .setParameter("uid", principal.getUser().getId()).getResultList();
        List<CourseOption> options = courses.stream().map(c -> new CourseOption(c.getId(), c.getName())).toList();
        Set<Long> allowedIds = new HashSet<>();
        courses.forEach(c -> allowedIds.add(c.getId()));
        if (courseId != null && !allowedIds.contains(courseId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Course is outside your analytics scope");
        }
        Set<Long> selected = courseId == null ? allowedIds : Set.of(courseId);
        List<CourseEnrollment> enrollments = selected.isEmpty() ? List.of() : em.createQuery("""
                select e from CourseEnrollment e join fetch e.user u join fetch e.course c
                where c.id in :courses and e.isActive = true and u.isActive = true
                  and exists (select r.id from User su join su.roles r
                              where su.id = u.id and r.name = 'STUDENT' and r.isActive = true)
                """, CourseEnrollment.class).setParameter("courses", selected).getResultList();
        Map<Long, User> users = new HashMap<>();
        enrollments.forEach(e -> users.put(e.getUser().getId(), e.getUser()));
        if (admin && courseId == null) {
            em.createQuery("""
                    select distinct u from User u join u.roles r
                    where u.isActive = true and r.name = 'STUDENT' and r.isActive = true
                    """, User.class).getResultList().forEach(u -> users.put(u.getId(), u));
        }
        List<Point> newcomers = newStudents(users.values(), from, to);
        List<Point> activity = activity(selected, from, to, interval);
        List<ProgressRow> progress = progress(enrollments, selected);
        List<RankedStudent> ranked = rankings(users, selected, enrollments);
        List<Bucket> buckets = distribution(users, enrollments);
        return new Report(options, newcomers, activity, ranked, progress.stream().limit(10).toList(),
                buckets, completionRate(selected, progress));
    }

    private List<Point> newStudents(java.util.Collection<User> users, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        for (LocalDate d = from.withDayOfMonth(1); !d.isAfter(to); d = d.plusMonths(1)) counts.put(d, 0L);
        for (User u : users) {
            if (u.getCreatedAt() == null) continue;
            LocalDate d = toVietnamTime(u.getCreatedAt(), ZoneId.systemDefault()).toLocalDate();
            if (!d.isBefore(from) && !d.isAfter(to)) counts.merge(d.withDayOfMonth(1), 1L, Long::sum);
        }
        return counts.entrySet().stream().map(e -> new Point(e.getKey().toString(), e.getValue())).toList();
    }

    private List<Point> activity(Set<Long> courses, LocalDate from, LocalDate to, Interval interval) {
        Map<LocalDate, Set<Long>> counts = new LinkedHashMap<>();
        for (LocalDate d = bucket(from, interval); !d.isAfter(to); d = next(d, interval)) counts.put(d, new HashSet<>());
        if (!courses.isEmpty()) {
            Instant start = from.atStartOfDay(ZONE).toInstant();
            Instant end = to.plusDays(1).atStartOfDay(ZONE).toInstant();
            List<StudentLearningActivity> events = em.createQuery("""
                    select a from StudentLearningActivity a join fetch a.enrollment e join fetch e.user u
                    where e.course.id in :courses and e.isActive = true and u.isActive = true
                      and a.occurredAt >= :start and a.occurredAt < :end
                      and exists (select r.id from User su join su.roles r
                                  where su.id = u.id and r.name = 'STUDENT' and r.isActive = true)
                    """, StudentLearningActivity.class).setParameter("courses", courses)
                    .setParameter("start", start).setParameter("end", end).getResultList();
            for (StudentLearningActivity e : events) {
                counts.get(bucket(e.getOccurredAt().atZone(ZONE).toLocalDate(), interval))
                        .add(e.getEnrollment().getUser().getId());
            }
        }
        return counts.entrySet().stream().map(e -> new Point(e.getKey().toString(), e.getValue().size())).toList();
    }

    private LocalDate bucket(LocalDate date, Interval interval) {
        return switch (interval) {
            case DAY -> date;
            case WEEK -> date.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
            case MONTH -> date.withDayOfMonth(1);
        };
    }

    private LocalDate next(LocalDate date, Interval interval) {
        return switch (interval) {
            case DAY -> date.plusDays(1);
            case WEEK -> date.plusWeeks(1);
            case MONTH -> date.plusMonths(1);
        };
    }

    static LocalDateTime toVietnamTime(LocalDateTime timestamp, ZoneId sourceZone) {
        return timestamp.atZone(sourceZone).withZoneSameInstant(ZONE).toLocalDateTime();
    }

    private List<ProgressRow> progress(List<CourseEnrollment> enrollments, Set<Long> courses) {
        if (courses.isEmpty()) return List.of();
        Map<Long, Long> lessonCounts = new HashMap<>();
        em.createQuery("""
                select l.section.course.id, count(l) from Lesson l
                where l.section.course.id in :courses and l.isActive = true and l.section.isActive = true
                group by l.section.course.id
                """, Object[].class).setParameter("courses", courses).getResultList()
                .forEach(row -> lessonCounts.put((Long) row[0], (Long) row[1]));
        Map<Long, Long> completed = new HashMap<>();
        em.createQuery("""
                select p.enrollment.id, count(p) from LessonProgress p
                where p.enrollment.course.id in :courses and p.completed = true
                  and p.lesson.isActive = true and p.lesson.section.isActive = true
                group by p.enrollment.id
                """, Object[].class).setParameter("courses", courses).getResultList()
                .forEach(row -> completed.put((Long) row[0], (Long) row[1]));
        List<ProgressRow> result = new ArrayList<>();
        for (CourseEnrollment e : enrollments) {
            long total = lessonCounts.getOrDefault(e.getCourse().getId(), 0L);
            if (total == 0) continue;
            BigDecimal pct = BigDecimal.valueOf(completed.getOrDefault(e.getId(), 0L))
                    .multiply(BigDecimal.valueOf(100)).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
            result.add(new ProgressRow(e.getUser().getId(), e.getUser().getFullName(), e.getCourse().getId(),
                    e.getCourse().getName(), pct,
                    e.getLastAccessedAt() == null ? null
                            : toVietnamTime(e.getLastAccessedAt(), ZoneId.systemDefault()).toString()));
        }
        result.sort(Comparator.comparing(ProgressRow::progress).thenComparing(ProgressRow::studentId)
                .thenComparing(ProgressRow::courseId));
        return result;
    }

    private List<RankedStudent> rankings(Map<Long, User> users, Set<Long> selected, List<CourseEnrollment> enrollments) {
        Map<Long, Set<Long>> membership = new HashMap<>();
        Map<Long, List<Course>> coursesByStudent = new HashMap<>();
        enrollments.forEach(e -> membership.computeIfAbsent(e.getUser().getId(), k -> new HashSet<>()).add(e.getCourse().getId()));
        enrollments.forEach(e -> coursesByStudent.computeIfAbsent(e.getUser().getId(), k -> new ArrayList<>()).add(e.getCourse()));
        var allScores = scoresService.findCourseScoresForStudents(coursesByStudent);
        record Score(Long id, String name, BigDecimal value, int count) {}
        List<Score> scores = new ArrayList<>();
        for (Long id : membership.keySet()) {
            var values = allScores.getOrDefault(id, List.of()).stream()
                    .filter(s -> selected.contains(s.courseId()) && membership.get(id).contains(s.courseId()))
                    .map(s -> s.overallScore()).filter(java.util.Objects::nonNull).toList();
            if (!values.isEmpty()) {
                BigDecimal average = values.stream().reduce(BigDecimal.ZERO, BigDecimal::add)
                        .divide(BigDecimal.valueOf(values.size()), 2, RoundingMode.HALF_UP);
                scores.add(new Score(id, users.get(id).getFullName(), average, values.size()));
            }
        }
        scores.sort(Comparator.comparing(Score::value).reversed().thenComparing(Score::id));
        List<RankedStudent> result = new ArrayList<>();
        int rank = 0;
        BigDecimal previous = null;
        for (int i = 0; i < Math.min(10, scores.size()); i++) {
            Score s = scores.get(i);
            if (previous == null || previous.compareTo(s.value()) != 0) rank = i + 1;
            result.add(new RankedStudent(rank, s.id(), s.name(), s.value(), s.count()));
            previous = s.value();
        }
        return result;
    }

    private List<Bucket> distribution(Map<Long, User> users, List<CourseEnrollment> enrollments) {
        Map<Long, Long> counts = new HashMap<>();
        enrollments.forEach(e -> counts.merge(e.getUser().getId(), 1L, Long::sum));
        long[] buckets = new long[5];
        users.keySet().forEach(id -> buckets[(int) Math.min(4, counts.getOrDefault(id, 0L))]++);
        List<Bucket> result = new ArrayList<>();
        for (int i = 0; i < buckets.length; i++) result.add(new Bucket(i == 4 ? "4+" : Integer.toString(i), buckets[i]));
        return result;
    }

    private CompletionRate completionRate(Set<Long> courses, List<ProgressRow> progress) {
        if (courses.isEmpty()) return new CompletionRate(0, 0, null);
        Set<Long> examCourses = new HashSet<>(em.createQuery(
                "select distinct e.course.id from Exam e where e.course.id in :courses and e.isActive = true", Long.class)
                .setParameter("courses", courses).getResultList());
        List<ExamAttempt> attempts = em.createQuery("""
                select a from ExamAttempt a join fetch a.exam e join fetch a.student s
                where e.course.id in :courses and e.isActive = true and a.submittedAt is not null
                """, ExamAttempt.class).setParameter("courses", courses).getResultList();
        Set<String> submitted = new HashSet<>();
        attempts.forEach(a -> submitted.add(a.getStudent().getId() + ":" + a.getExam().getCourse().getId()));
        long total = 0, without = 0;
        for (ProgressRow row : progress) {
            if (row.progress().compareTo(BigDecimal.valueOf(100)) != 0 || !examCourses.contains(row.courseId())) continue;
            total++;
            if (!submitted.contains(row.studentId() + ":" + row.courseId())) without++;
        }
        BigDecimal pct = total == 0 ? null : BigDecimal.valueOf(without).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        return new CompletionRate(total, without, pct);
    }
}
