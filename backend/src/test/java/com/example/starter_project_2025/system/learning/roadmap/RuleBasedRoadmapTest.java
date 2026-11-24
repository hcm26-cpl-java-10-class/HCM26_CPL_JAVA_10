package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.course.CourseLevel;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuleBasedRoadmapTest {
    private final RoadmapGoal goal = new RoadmapGoal("Java Backend Developer", CourseLevel.BEGINNER, 2, null, 5);

    @Test
    void recommendsOnlyRelevantUnfinishedCoursesThatFitTheBudget() {
        var phases = RuleBasedRoadmap.suggest(goal, List.of(
                course(1, "Java Basics", 60, RoadmapCatalog.Status.PLANNED),
                course(2, "Java Advanced", 900, RoadmapCatalog.Status.PLANNED),
                course(3, "Java Syntax", 60, RoadmapCatalog.Status.COMPLETED),
                course(4, "Piano", 60, RoadmapCatalog.Status.PLANNED)));

        assertEquals(1, phases.size());
        assertEquals(List.of(1L), phases.getFirst().courseIds());
        assertEquals(5, phases.getFirst().endWeek());
    }

    @Test
    void permitsUnknownDurationWithoutInventingOne() {
        var phases = RuleBasedRoadmap.suggest(goal, List.of(course(1, "Java APIs", 0, RoadmapCatalog.Status.ENROLLED)));
        assertEquals(List.of(1L), phases.getFirst().courseIds());
    }

    @Test
    void unrelatedCatalogProducesNoSuggestion() {
        assertTrue(RuleBasedRoadmap.suggest(goal, List.of(course(1, "Piano", 60, RoadmapCatalog.Status.PLANNED))).isEmpty());
    }

    @Test
    void distributesPracticeWeeksAcrossTheSelectedCourses() {
        var phases = RuleBasedRoadmap.suggest(goal, List.of(
                course(1, "Java Basics", 60, RoadmapCatalog.Status.PLANNED),
                course(2, "Java APIs", 60, RoadmapCatalog.Status.ENROLLED)));
        assertEquals(2, phases.size());
        assertEquals(1, phases.getFirst().startWeek());
        assertEquals(2, phases.getFirst().endWeek());
        assertEquals(3, phases.getLast().startWeek());
        assertEquals(5, phases.getLast().endWeek());
    }

    @Test
    void prefersTheLearnersLevelWhenRelevanceIsEqualAndOnlyOneCourseFits() {
        var advanced = new RoadmapGoal(goal.careerGoal(), CourseLevel.ADVANCED, 1, null, 1);
        var phases = RuleBasedRoadmap.suggest(advanced, List.of(
                course(1, "Java Basics", 60, RoadmapCatalog.Status.PLANNED),
                new RoadmapCatalog.Candidate(2L, "Java APIs", null, null, CourseLevel.ADVANCED,
                        60, RoadmapCatalog.Status.PLANNED)));
        assertEquals(List.of(2L), phases.getFirst().courseIds());
    }

    private RoadmapCatalog.Candidate course(long id, String title, long duration, RoadmapCatalog.Status status) {
        return new RoadmapCatalog.Candidate(id, title, null, null, CourseLevel.BEGINNER, duration, status);
    }
}
