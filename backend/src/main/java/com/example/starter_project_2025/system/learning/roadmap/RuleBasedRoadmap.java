package com.example.starter_project_2025.system.learning.roadmap;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

final class RuleBasedRoadmap {
    private static final List<String> PYTHON_TERMS = List.of("python", "django", "flask", "fastapi");
    private static final Set<String> GENERIC_WORDS = Set.of("developer", "engineer", "learn", "learning",
            "beginner", "advanced", "with", "from", "the", "and", "for");

    private RuleBasedRoadmap() {}

    static List<LearningRoadmapService.Phase> suggest(RoadmapGoal goal, List<RoadmapCatalog.Candidate> courses) {
        Set<String> keywords = keywords(goal.careerGoal());
        var searchTerms = keywords.contains("python") ? PYTHON_TERMS : keywords;
        int minutesPerWeek = goal.hoursPerWeek() * 60;
        int nextWeek = 1;
        var phases = new ArrayList<LearningRoadmapService.Phase>();
        var ranked = courses.stream()
                .filter(course -> course.status() != RoadmapCatalog.Status.COMPLETED)
                .map(course -> new Ranked(course, relevance(course, searchTerms)))
                .filter(course -> course.score() > 0)
                .filter(item -> Math.max(1L, Math.ceilDiv(item.course().durationMinutes(), minutesPerWeek))
                        <= goal.targetWeeks())
                .sorted(Comparator.comparingInt(Ranked::score).reversed()
                        .thenComparingInt(item -> Math.abs(difficulty(item.course(), goal) - goal.currentLevel().ordinal()))
                        .thenComparing(item -> item.course().id()))
                .limit(16)
                .toList();
        var selected = new ArrayList<RoadmapCatalog.Candidate>();
        long selectedWeeks = 0;
        for (var rankedCourse : ranked) {
            var course = rankedCourse.course();
            long weeks = Math.max(1L, Math.ceilDiv(course.durationMinutes(), minutesPerWeek));
            if (selectedWeeks + weeks > goal.targetWeeks()) continue;
            selected.add(course);
            selectedWeeks += weeks;
            if (selected.size() == 8) break;
        }
        selected.sort(Comparator.comparingInt(course -> difficulty(course, goal)));
        for (var course : selected) {
            long weeks = Math.max(1L, Math.ceilDiv(course.durationMinutes(), minutesPerWeek));
            int lastWeek = nextWeek + (int) weeks - 1;
            phases.add(new LearningRoadmapService.Phase(course.title(), nextWeek, lastWeek, List.of(course.id()),
                    course.description(), java.util.Map.of(course.id(), "The catalog title or description matches terms from your career goal.")));
            nextWeek = lastWeek + 1;
        }
        if (!phases.isEmpty()) {
            int minimumTotal = nextWeek - 1;
            int extraWeeks = goal.targetWeeks() - minimumTotal;
            int previousExtra = 0;
            int startWeek = 1;
            for (int i = 0; i < phases.size(); i++) {
                var phase = phases.get(i);
                int cumulativeExtra = (int) ((long) extraWeeks * phase.endWeek() / minimumTotal);
                int span = phase.endWeek() - phase.startWeek() + 1 + cumulativeExtra - previousExtra;
                phases.set(i, new LearningRoadmapService.Phase(phase.title(), startWeek,
                        startWeek + span - 1, phase.courseIds(), phase.objective(), phase.reasons()));
                startWeek += span;
                previousExtra = cumulativeExtra;
            }
        }
        return List.copyOf(phases);
    }

    private record Ranked(RoadmapCatalog.Candidate course, int score) {}

    static boolean matchesRequiredTechnology(RoadmapGoal goal, RoadmapCatalog.Candidate course) {
        return !keywords(goal.careerGoal()).contains("python") || relevance(course, PYTHON_TERMS) > 0;
    }

    static List<String> pythonSearchTerms(RoadmapGoal goal) {
        return keywords(goal.careerGoal()).contains("python") ? PYTHON_TERMS : List.of();
    }

    private static int relevance(RoadmapCatalog.Candidate course, java.util.Collection<String> goal) {
        var title = keywords(course.title());
        var description = keywords(Objects.toString(course.description(), ""));
        var category = keywords(Objects.toString(course.category(), ""));
        return goal.stream().mapToInt(term -> title.contains(term) ? 3
                : category.contains(term) ? 2 : description.contains(term) ? 1 : 0).sum();
    }

    private static int difficulty(RoadmapCatalog.Candidate course, RoadmapGoal goal) {
        return course.level() == null ? goal.currentLevel().ordinal() : course.level().ordinal();
    }

    private static Set<String> keywords(String value) {
        return Arrays.stream(value.toLowerCase(Locale.ROOT).split("[^\\p{L}\\p{N}+#]+"))
                .filter(word -> word.length() >= 2 && !GENERIC_WORDS.contains(word))
                .collect(Collectors.toSet());
    }
}
