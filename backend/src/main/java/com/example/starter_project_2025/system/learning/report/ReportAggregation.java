package com.example.starter_project_2025.system.learning.report;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import com.example.starter_project_2025.system.exam.result.service.PublishedExamScoreService;
import com.example.starter_project_2025.system.learning.habits.HabitStatistics;
import com.example.starter_project_2025.system.learning.roadmap.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.math.*;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
import static com.example.starter_project_2025.system.learning.report.ReportData.*;

@Service
@RequiredArgsConstructor
class ReportAggregation {
    private final CourseEnrollmentService enrollments;
    private final RoadmapCatalog catalog;
    private final LessonProgressService progress;
    private final LearningRoadmapService roadmaps;
    private final HabitStatistics habits;
    private final PublishedExamScoreService scores;

    static Set<Section> sections(UserPrincipal principal) {
        var result = EnumSet.allOf(Section.class);
        if (!has(principal, "COURSE_READ")) result.removeAll(Set.of(Section.COURSES, Section.ROADMAP));
        if (!has(principal, "EXAM_TAKE")) result.remove(Section.ASSESSMENTS);
        return result;
    }

    static boolean has(UserPrincipal principal, String permission) {
        return principal.getAuthorities().stream().anyMatch(grant -> permission.equals(grant.getAuthority()));
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(UserPrincipal principal, Input input, Set<Section> sections) {
        Long owner = principal.getUser().getId();
        boolean canReadProgress = has(principal, "LESSON_PROGRESS_READ") && has(principal, "COURSE_READ");
        List<String> limitations = new ArrayList<>();
        Overview overview = null;
        List<Course> courses = null;
        if (sections.contains(Section.OVERVIEW) || sections.contains(Section.COURSES)) {
            var rows = enrollments.getMyCourses(owner);
            var views = canReadProgress ? catalog.enrolledViews(owner).stream()
                .collect(Collectors.toMap(RoadmapCatalog.CourseView::enrollmentId, v -> v)) : Map.<Long,RoadmapCatalog.CourseView>of();
            int enrolledInPeriod = 0;
            List<Course> measured = new ArrayList<>();
            for (var row : rows) {
                var enrolledOn = row.getCreatedAt() == null ? null : row.getCreatedAt().toLocalDate();
                if (enrolledOn != null && inside(enrolledOn, input)) enrolledInPeriod++;
                var view = views.get(row.getId());
                var lessons = sections.contains(Section.COURSES) && canReadProgress ? progress.getProgress(owner, row.getId()) : null;
                measured.add(new Course(row.getCourse().getId(), row.getCourse().getName(), enrolledOn,
                    view == null ? "UNKNOWN" : view.status().name(), view == null ? null : view.progressPercent(),
                    lessons == null || lessons.totalLessons() == 0 ? null : lessons.completedLessons(),
                    lessons == null || lessons.totalLessons() == 0 ? null : lessons.totalLessons()));
            }
            if (sections.contains(Section.OVERVIEW)) overview = overview(measured, enrolledInPeriod);
            if (sections.contains(Section.COURSES)) courses = measured;
            limitations.add("COURSE_STATUS_CURRENT");
            if (!canReadProgress) limitations.add("COURSE_PROGRESS_UNAVAILABLE");
        }

        var study = sections.contains(Section.STUDY) || sections.contains(Section.OBJECTIVES)
            ? habits.report(owner, input.from(), input.to(), input.type() != Type.WEEKLY
                && (input.type() != Type.CUSTOM || input.from().plusDays(27).isBefore(input.to()))) : null;
        var objectiveStats = sections.contains(Section.OBJECTIVES) ? study.objectives() : null;
        if (objectiveStats != null) limitations.add("OBJECTIVE_STATUS_CURRENT");
        if (sections.contains(Section.STUDY)) limitations.add("STUDY_SELF_REPORTED");
        Roadmap roadmap = sections.contains(Section.ROADMAP) ? roadmap(owner, canReadProgress) : null;
        if (sections.contains(Section.ROADMAP)) limitations.add(roadmap == null ? "ROADMAP_UNAVAILABLE" : "ROADMAP_CURRENT");
        Assessments assessments = sections.contains(Section.ASSESSMENTS) ? assessment(owner, input) : null;
        if (assessments != null) limitations.add("PUBLISHED_ASSESSMENTS_ONLY");
        var reportStudy = sections.contains(Section.STUDY) ? study : null;
        if (reportStudy != null && !has(principal, "COURSE_READ")) {
            reportStudy = new HabitStatistics.ReportStudy(study.actualSeconds(), study.timerSeconds(),
                study.selfReportedSeconds(), study.plannedSeconds(), study.remainingSeconds(), study.coveredActualSeconds(),
                study.achievement(), study.coveredDays(), study.activeDays(), study.averageActiveDaySeconds(),
                study.currentStreak(), study.longestStreak(), study.days(), study.weeks(), List.of(), null);
        }
        return new Snapshot(principal.getUser().getFullName(), overview, courses, reportStudy,
            roadmap, objectiveStats, assessments, limitations);
    }

    static Overview overview(List<Course> rows, int enrolledInPeriod) {
        int completed = (int) rows.stream().filter(row -> "COMPLETED".equals(row.status())).count();
        int inProgress = (int) rows.stream().filter(row -> "IN_PROGRESS".equals(row.status())).count();
        int notStarted = (int) rows.stream().filter(row -> "ENROLLED".equals(row.status())).count();
        var measured = rows.stream().map(Course::percent).filter(Objects::nonNull).toList();
        return new Overview(rows.size(), enrolledInPeriod, completed, inProgress, notStarted,
            rows.size() - completed - inProgress - notStarted, rate(completed, rows.size()),
            measured.isEmpty() ? null : measured.stream().mapToInt(Integer::intValue).average().orElseThrow(), measured.size());
    }

    static Double rate(int count, int total) { return total == 0 ? null : 100.0 * count / total; }

    private Roadmap roadmap(Long owner, boolean canReadProgress) {
        var plan = roadmaps.get(owner);
        if (plan.goal() == null) return null;
        boolean chosenCurrent = false;
        int complete = 0;
        List<Phase> phases = new ArrayList<>();
        for (var phase : plan.phases()) {
            boolean done = canReadProgress && !phase.courses().isEmpty() && phase.courses().stream()
                .allMatch(course -> course.status() == RoadmapCatalog.Status.COMPLETED);
            boolean hasNext = phase.courses().stream().anyMatch(course ->
                course.status() != RoadmapCatalog.Status.COMPLETED && course.status() != RoadmapCatalog.Status.UNAVAILABLE);
            String status = !canReadProgress ? "UNKNOWN" : done ? "COMPLETED"
                : !chosenCurrent && hasNext ? "CURRENT" : "UPCOMING";
            if ("CURRENT".equals(status)) chosenCurrent = true;
            if (done) complete++;
            var courses = phase.courses().stream().map(course -> new Course(course.id(), course.title(), null,
                course.status() == RoadmapCatalog.Status.UNAVAILABLE || canReadProgress ? course.status().name() : "UNKNOWN",
                canReadProgress ? course.progressPercent() : null, null, null)).toList();
            phases.add(new Phase(phase.title(), phase.startWeek(), phase.endWeek(), status, phase.objective(), courses));
        }
        return new Roadmap(plan.goal().careerGoal(), plan.goal().currentLevel().name(), plan.title(), plan.revision(),
            plan.generatedAt(), plan.targetWeeks(), plan.goal().targetWeeks() * plan.goal().hoursPerWeek() * 60L,
            complete, canReadProgress ? rate(complete, phases.size()) : null, phases);
    }

    private Assessments assessment(Long owner, Input input) {
        ZoneId zone = habits.reportingZone();
        var results = scores.findMyPublishedScores(owner).stream()
            .filter(row -> row.resultPublished() && row.finalScore() != null && row.maxScore() != null
                && row.maxScore().signum() > 0 && row.submittedAt() != null
                && inside(LocalDate.ofInstant(row.submittedAt(), zone), input))
            .map(row -> new Score(row.examTitle(), row.submittedAt(), row.finalScore(), row.maxScore(),
                row.finalScore().multiply(BigDecimal.valueOf(100)).divide(row.maxScore(), 4, RoundingMode.HALF_UP)))
            .toList();
        BigDecimal average = results.isEmpty() ? null : results.stream().map(Score::percent).reduce(BigDecimal.ZERO, BigDecimal::add)
            .divide(BigDecimal.valueOf(results.size()), 2, RoundingMode.HALF_UP);
        return new Assessments(results.size(), average, results);
    }

    private boolean inside(LocalDate date, Input input) { return !date.isBefore(input.from()) && !date.isAfter(input.to()); }

    @Transactional(readOnly = true)
    public PerformanceDashboard performanceDashboard(UserPrincipal principal, LocalDate from, LocalDate to, Long courseId) {
        var zone = habits.reportingZone();
        LocalDate end = to != null ? to : LocalDate.now(zone);
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) throw new IllegalArgumentException("Start date must not be after end date");
        var input = new Input(UUID.randomUUID(), "Performance", Type.CUSTOM, start, end, Mode.STANDARD, Language.EN,
            EnumSet.of(Section.OVERVIEW, Section.COURSES, Section.ROADMAP, Section.ASSESSMENTS));
        var allowed = sections(principal);
        allowed.retainAll(Set.of(Section.OVERVIEW, Section.COURSES, Section.ROADMAP, Section.ASSESSMENTS));
        var snap = snapshot(principal, input, allowed);
        var courses = snap.courses();
        if (courseId != null && courses != null) {
            courses = courses.stream().filter(c -> courseId.equals(c.id())).toList();
        }
        return new PerformanceDashboard(start, end, zone.getId(), snap.overview(), courses,
            snap.roadmap(), snap.assessments(), snap.limitations());
    }

    @Transactional(readOnly = true)
    public GoalsHabitsDashboard goalsHabitsDashboard(UserPrincipal principal, LocalDate from, LocalDate to) {
        var zone = habits.reportingZone();
        LocalDate end = to != null ? to : LocalDate.now(zone);
        LocalDate start = from != null ? from : end.minusDays(29);
        if (start.isAfter(end)) throw new IllegalArgumentException("Start date must not be after end date");
        var input = new Input(UUID.randomUUID(), "Goals & Habits", Type.CUSTOM, start, end, Mode.STANDARD, Language.EN,
            EnumSet.of(Section.STUDY, Section.OBJECTIVES));
        var snap = snapshot(principal, input, EnumSet.of(Section.STUDY, Section.OBJECTIVES));
        return new GoalsHabitsDashboard(start, end, zone.getId(), snap.study(), snap.objectives(), snap.limitations());
    }
}
