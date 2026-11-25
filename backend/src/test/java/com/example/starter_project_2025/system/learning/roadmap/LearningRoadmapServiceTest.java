package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.learning.LearningAiGateway;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class LearningRoadmapServiceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final LearningRoadmapStore store = mock(LearningRoadmapStore.class);
    private final RoadmapCatalog catalog = mock(RoadmapCatalog.class);
    private final LearningAiGateway ai = mock(LearningAiGateway.class);
    private final LearningRoadmapService service = new LearningRoadmapService(store, catalog, ai, mapper);
    private final RoadmapGoal goal = new RoadmapGoal("Java Backend Developer", CourseLevel.BEGINNER, 8, 3);
    private final Map<Long, RoadmapCatalog.Candidate> courses = Map.of(
            15L, candidate(15L, 50, RoadmapCatalog.Status.COMPLETED),
            19L, candidate(19L, 200, RoadmapCatalog.Status.PLANNED));

    @Test
    void acceptsAnOrderedTwelveWeekRoadmapFromTheCatalog() throws Exception {
        var phases = service.parsePhases(mapper.readTree("""
                {"phases":[
                  {"title":"Foundations","startWeek":1,"endWeek":2,"courseIds":[15]},
                  {"title":"Backend Development","startWeek":3,"endWeek":12,"courseIds":[19]}
                ]}
                """), goal, courses);
        assertEquals(12, phases.getLast().endWeek());
        assertEquals(19L, phases.getLast().courseIds().getFirst());
    }

    @Test
    void rejectsInventedCoursesDuplicateCoursesAndGaps() throws Exception {
        for (String badPlan : new String[]{
                """
                {"phases":[{"title":"Backend","startWeek":1,"endWeek":12,"courseIds":[99]}]}
                """,
                """
                {"phases":[{"title":"Backend","startWeek":1,"endWeek":12,"courseIds":[19,19]}]}
                """,
                """
                {"phases":[{"title":"Backend","startWeek":1,"endWeek":10,"courseIds":[19]}]}
                """
        }) {
            var json = mapper.readTree(badPlan);
            assertThrows(IllegalArgumentException.class, () -> service.parsePhases(json, goal, courses));
        }
    }

    @Test
    void reallocatesWeeksWhenOnePhaseExceedsItsProposedAllocation() throws Exception {
        var json = mapper.readTree("""
                {"phases":[
                  {"title":"Backend","startWeek":1,"endWeek":1,"courseIds":[19]},
                  {"title":"Foundations","startWeek":2,"endWeek":12,"courseIds":[15]}
                ]}
                """);
        var tightSchedule = new RoadmapGoal(goal.careerGoal(), goal.currentLevel(), 1, 3);
        var phases = service.parsePhases(json, tightSchedule, courses);
        assertEquals(4, phases.getFirst().endWeek());
        assertEquals(5, phases.getLast().startWeek());
        assertEquals(12, phases.getLast().endWeek());
    }

    @Test
    void fitsTwentyFourWeekScheduleWithoutIncreasingWeeklyHours() throws Exception {
        var json = mapper.readTree("""
                {"phases":[
                  {"title":"Backend","startWeek":1,"endWeek":1,"courseIds":[19]},
                  {"title":"Database","startWeek":2,"endWeek":24,"courseIds":[20]}
                ]}
                """);
        var schedule = new RoadmapGoal(goal.careerGoal(), goal.currentLevel(), 6, null, 24);
        var selected = Map.of(19L, candidate(19L, 2880, RoadmapCatalog.Status.PLANNED),
                20L, candidate(20L, 5400, RoadmapCatalog.Status.PLANNED));
        var phases = service.parsePhases(json, schedule, selected);
        assertEquals(8, phases.getFirst().endWeek());
        assertEquals(9, phases.getLast().startWeek());
        assertEquals(24, phases.getLast().endWeek());
    }

    @Test
    void rejectsCoursesThatCannotFitWithinSixHoursForTwentyFourWeeks() throws Exception {
        var json = mapper.readTree("""
                {"phases":[{"title":"Backend","startWeek":1,"endWeek":24,"courseIds":[19]}]}
                """);
        var schedule = new RoadmapGoal(goal.careerGoal(), goal.currentLevel(), 6, null, 24);
        var tooLong = Map.of(19L, candidate(19L, 9000, RoadmapCatalog.Status.PLANNED));
        var error = assertThrows(ResponseStatusException.class, () -> service.parsePhases(json, schedule, tooLong));
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, error.getStatusCode());
        assertTrue(error.getReason().contains("25 weeks"));
    }

    @Test
    void staleRevisionDoesNotCallTheProvider() {
        when(store.get(42L)).thenReturn(new LearningRoadmapStore.SavedRoadmap(goal, 3L, null, null));
        var error = assertThrows(ResponseStatusException.class, () -> service.generate(42L, 1L));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verifyNoInteractions(ai, catalog);
    }

    @Test
    void savedPhasesDisplayCurrentCourseProgress() {
        when(store.get(42L)).thenReturn(new LearningRoadmapStore.SavedRoadmap(goal, 3L, """
                [{"title":"Backend","startWeek":1,"endWeek":12,"courseIds":[19]}]
                """, Instant.EPOCH));
        when(catalog.courseViews(42L, java.util.Set.of(19L))).thenReturn(Map.of(19L,
                new RoadmapCatalog.CourseView(19L, "Java", RoadmapCatalog.Status.COMPLETED)));
        assertEquals(RoadmapCatalog.Status.COMPLETED, service.get(42L).phases().getFirst().courses().getFirst().status());
    }

    private RoadmapCatalog.Candidate candidate(Long id, long minutes, RoadmapCatalog.Status status) {
        return new RoadmapCatalog.Candidate(id, "Java", null, null, CourseLevel.BEGINNER, minutes, status);
    }
}
