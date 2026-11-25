package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import com.example.starter_project_2025.system.demo.lesson.CourseCatalogService;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.lesson.CourseLessonStats;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RoadmapCatalog {
    private static final int MAX_CANDIDATES = 48;

    private final CourseCatalogService catalog;
    private final CourseRepository courses;
    private final CourseEnrollmentService enrollments;
    private final LessonProgressService progress;
    private final CertificateRepository certificates;
    private final LessonRepository lessons;

    public enum Status { PLANNED, ENROLLED, IN_PROGRESS, COMPLETED, UNAVAILABLE }

    public record Candidate(Long id, String title, String description, String category, CourseLevel level,
                            long durationMinutes, Status status, Integer progressPercent) {
        public Candidate(Long id, String title, String description, String category, CourseLevel level,
                         long durationMinutes, Status status) {
            this(id, title, description, category, level, durationMinutes, status, null);
        }
    }

    public record CourseView(Long id, String title, Status status, Long enrollmentId, Integer progressPercent,
                             Long durationMinutes) {
        public CourseView(Long id, String title, Status status) {
            this(id, title, status, null, null, null);
        }
    }

    public List<Candidate> candidates(Long userId, RoadmapGoal goal) {
        Map<Long, CatalogCourseDTO> results = new LinkedHashMap<>();
        // Search by individual goal terms before filling the remaining slots from the catalog.
        Arrays.stream(goal.careerGoal().split("[^\\p{L}\\p{N}+#.]+"))
                .map(String::strip)
                .filter(term -> term.length() >= 2)
                .distinct()
                .limit(6)
                .forEach(term -> addCourses(results, term, 8));
        if (results.size() < MAX_CANDIDATES) {
            addCourses(results, null, MAX_CANDIDATES);
        }
        var learner = learnerCourses(userId);
        return results.values().stream().limit(MAX_CANDIDATES)
                .map(course -> {
                    var activity = activity(userId, course.id(), learner);
                    return new Candidate(course.id(), course.name(), course.description(), course.categoryName(),
                            course.level(), durationMinutes(course.totalDuration()), activity.status(), activity.percent());
                })
                .toList();
    }

    private void addCourses(Map<Long, CatalogCourseDTO> results, String search, int size) {
        catalog.search(search, null, null, PageRequest.of(0, size), null)
                .forEach(course -> results.putIfAbsent(course.id(), course));
    }

    public Map<Long, CourseView> courseViews(Long userId, Set<Long> courseIds) {
        var learner = learnerCourses(userId);
        var durations = lessons.findStatsByCourseIds(courseIds).stream()
                .filter(stats -> stats.totalDuration() > 0)
                .collect(Collectors.toMap(CourseLessonStats::courseId, stats -> durationMinutes(stats.totalDuration())));
        return courses.findAllById(courseIds).stream().collect(Collectors.toMap(course -> course.getId(), course -> {
            boolean available = course.getStatus() == CourseStatus.PUBLISHED && Boolean.TRUE.equals(course.getIsActive());
            if (!available) return new CourseView(course.getId(), "Unavailable course", Status.UNAVAILABLE);
            var activity = activity(userId, course.getId(), learner);
            return new CourseView(course.getId(), course.getName(), activity.status(), activity.enrollmentId(),
                    activity.percent(), durations.get(course.getId()));
        }));
    }

    private static long durationMinutes(long catalogSeconds) {
        // Catalog totals sum lesson durations stored in seconds. Round once per course.
        return Math.ceilDiv(Math.max(0, catalogSeconds), 60L);
    }

    public List<CourseView> enrolledViews(Long userId) {
        var learner = learnerCourses(userId);
        return learner.enrolled().values().stream().map(enrollment -> {
            var course = enrollment.getCourse();
            var activity = activity(userId, course.getId(), learner);
            return new CourseView(course.getId(), course.getName(), activity.status(), enrollment.getId(),
                    activity.percent(), null);
        }).toList();
    }

    private record LearnerCourses(Map<Long, CourseEnrollment> enrolled, Set<Long> certified) {}

    private LearnerCourses learnerCourses(Long userId) {
        var enrolled = enrollments.getMyCourses(userId).stream()
                .collect(Collectors.toMap(item -> item.getCourse().getId(), Function.identity(),
                        (first, second) -> first, LinkedHashMap::new));
        var certified = certificates.findAllByUser_Id(userId).stream()
                .map(item -> item.getCourse().getId()).collect(Collectors.toSet());
        return new LearnerCourses(enrolled, certified);
    }

    private record Activity(Status status, Long enrollmentId, Integer percent) {}

    private Activity activity(Long userId, Long courseId, LearnerCourses learner) {
        CourseEnrollment enrollment = learner.enrolled().get(courseId);
        if (learner.certified().contains(courseId)) {
            return new Activity(Status.COMPLETED, enrollment == null ? null : enrollment.getId(), 100);
        }
        if (enrollment == null) {
            return new Activity(Status.PLANNED, null, null);
        }
        var record = progress.getProgress(userId, enrollment.getId());
        Integer percent = record.totalLessons() > 0 ? record.progressPercentage() : null;
        if (record.totalLessons() > 0 && record.completedLessons() == record.totalLessons()) {
            return new Activity(Status.COMPLETED, enrollment.getId(), 100);
        }
        Status status = (record.lastAccessedAt() != null || record.completedLessons() > 0) ? Status.IN_PROGRESS : Status.ENROLLED;
        return new Activity(status, enrollment.getId(), percent);
    }
}
