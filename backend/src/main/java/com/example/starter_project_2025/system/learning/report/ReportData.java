package com.example.starter_project_2025.system.learning.report;

import com.example.starter_project_2025.system.learning.habits.HabitStatistics.ReportStudy;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;

public final class ReportData {
    private ReportData() {}
    public enum Type { WEEKLY, MONTHLY, QUARTERLY, CUSTOM }
    public enum Mode { STANDARD, AI_ENHANCED }
    public enum Language { EN, VI }
    public enum Section { OVERVIEW, COURSES, STUDY, ROADMAP, OBJECTIVES, ASSESSMENTS, AI }
    public enum AnalysisStatus { NOT_REQUESTED, PENDING, AVAILABLE, UNAVAILABLE }
    public record Input(@NotNull UUID requestKey, @NotBlank @Size(max=150) String title,
        @NotNull Type type, @NotNull LocalDate from, @NotNull LocalDate to, @NotNull Mode mode,
        @NotNull Language language, @NotEmpty Set<@NotNull Section> sections) {}
    public record Title(@NotBlank @Size(max=150) String title) {}
    public record Options(LocalDate today, String zone, int maxDays, boolean aiAvailable, Set<Section> sections) {}
    public record Overview(int enrolled, int enrolledInPeriod, int completed, int inProgress,
        int notStarted, int unknown, Double completionRate, Double averageProgress, int measuredCourses) {}
    public record Course(Long id, String name, LocalDate enrolledOn, String status, Integer percent,
        Integer completedLessons, Integer totalLessons) {}
    public record Phase(String title, int startWeek, int endWeek, String status, String objective, List<Course> courses) {}
    public record Roadmap(String goal, String level, String title, Long revision, Instant generatedAt, Integer weeks,
        long budgetMinutes, int completedPhases, Double completionRate, List<Phase> phases) {}
    public record Score(String title, Instant submittedAt, BigDecimal score, BigDecimal maxScore, BigDecimal percent) {}
    public record Assessments(int results, BigDecimal averagePercent, List<Score> scores) {}
    public record Snapshot(String learner, Overview overview, List<Course> courses, ReportStudy study,
        Roadmap roadmap, ReportStudy.Objectives objectives, Assessments assessments, List<String> limitations) {}
    public record Finding(String title, String description, List<String> evidenceMetricIds) {}
    public record Recommendation(String priority, String action, String reason, List<String> relatedCourseIds) {}
    public record Analysis(String executiveSummary, List<Finding> achievements, List<Finding> improvementAreas,
        List<Recommendation> recommendations, List<String> nextPeriodActionPlan, List<String> dataLimitations) {}
    public record Item(Long id, String title, Type type, LocalDate from, LocalDate to, String zone, boolean periodToDate,
        Mode mode, Language language, Set<Section> sections, Instant generatedAt, AnalysisStatus aiStatus, boolean retryable) {}
    public record Detail(Item report, Snapshot snapshot, Analysis analysis, Map<String, Number> evidence) {}
    public record History(List<Item> items, long matches, long totalSaved, long createdThisMonth, Instant lastGenerated) {}
}
