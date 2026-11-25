package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.learning.LearningAiGateway;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class RoadmapAdviceTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final LearningRoadmapStore store = mock(LearningRoadmapStore.class);
    private final RoadmapCatalog catalog = mock(RoadmapCatalog.class);
    private final LearningAiGateway ai = mock(LearningAiGateway.class);
    private final LearningRoadmapService service = new LearningRoadmapService(store, catalog, ai, mapper);
    private final RoadmapGoal goal = new RoadmapGoal("Java Developer", CourseLevel.BEGINNER, 8, null, 24);
    private final String savedJson = """
            {"source":"RULE_BASED","title":null,"summary":null,"advice":[],
             "phases":[{"title":"Java","startWeek":1,"endWeek":24,"courseIds":[7],
                        "objective":"Practice Java","reasons":{"7":"Matches Java"}}]}
            """;

    @Test
    void createsAndPersistsTheRoadmapWithoutCallingTheAiProvider() {
        when(store.get(42L)).thenReturn(saved());
        when(catalog.candidates(42L, goal)).thenReturn(List.of(new RoadmapCatalog.Candidate(7L,
                "Java", "Practice Java", null, CourseLevel.BEGINNER, 60, RoadmapCatalog.Status.PLANNED)));
        persistWrites();

        var result = service.generate(42L, 3L);

        assertEquals("RULE_BASED", result.source());
        assertEquals(24, result.phases().getFirst().endWeek());
        verify(store).savePlan(eq(42L), eq(3L), anyString());
        verify(ai, never()).generate(anyLong(), anyString(), any(), any());
    }

    @Test
    void adviceCannotChangeTheSelectedCoursesOrWeeklySchedule() throws Exception {
        when(store.get(42L)).thenReturn(saved());
        when(catalog.courseViews(42L, Set.of(7L))).thenReturn(Map.of(7L,
                new RoadmapCatalog.CourseView(7L, "Java", RoadmapCatalog.Status.ENROLLED, 999L, 0, 60L)));
        when(ai.generate(eq(42L), anyString(), any(), any())).thenAnswer(invocation -> {
            Function<JsonNode, ?> parse = invocation.getArgument(3);
            return parse.apply(mapper.readTree("""
                    {"advice":["Practice the Java examples."],"courseIds":[12345],"startWeek":99}
                    """));
        });
        persistWrites();

        var result = service.advise(42L, 3L);

        assertEquals("RULE_BASED_WITH_AI_ADVICE", result.source());
        assertEquals(List.of("Practice the Java examples."), result.advice());
        assertEquals(1, result.phases().getFirst().startWeek());
        assertEquals(24, result.phases().getFirst().endWeek());
        assertEquals(7L, result.phases().getFirst().courses().getFirst().id());
        var evidence = ArgumentCaptor.forClass(Object.class);
        verify(ai).generate(eq(42L), anyString(), evidence.capture(), any());
        assertFalse(mapper.writeValueAsString(evidence.getValue()).contains("999"));
    }

    @Test
    void providerFailurePreservesTheSavedRoadmap() {
        when(store.get(42L)).thenReturn(saved());
        when(catalog.courseViews(42L, Set.of(7L))).thenReturn(Map.of(7L,
                new RoadmapCatalog.CourseView(7L, "Java", RoadmapCatalog.Status.PLANNED)));
        when(ai.generate(eq(42L), anyString(), any(), any()))
                .thenThrow(new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Provider returned HTTP 503"));

        assertThrows(ResponseStatusException.class, () -> service.advise(42L, 3L));
        verify(store, never()).savePlan(anyLong(), anyLong(), anyString());
    }

    @Test
    void changedGoalRequiresAnUpdatedRoadmapBeforeAdvice() {
        when(store.get(42L)).thenReturn(new LearningRoadmapStore.SavedRoadmap(goal, 3L, savedJson, Instant.EPOCH, true));
        var error = assertThrows(ResponseStatusException.class, () -> service.advise(42L, 3L));
        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
        verifyNoInteractions(ai, catalog);
    }

    private LearningRoadmapStore.SavedRoadmap saved() {
        return new LearningRoadmapStore.SavedRoadmap(goal, 3L, savedJson, Instant.EPOCH);
    }

    private void persistWrites() {
        when(store.savePlan(eq(42L), eq(3L), anyString())).thenAnswer(invocation ->
                new LearningRoadmapStore.SavedRoadmap(goal, 4L, invocation.getArgument(2), Instant.EPOCH));
    }
}
