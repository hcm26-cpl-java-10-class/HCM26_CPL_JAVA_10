package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyllabusCourseAiSuggestionServiceTest {
    @Mock CourseFromSyllabusService sourceService;
    @Mock SyllabusCourseGeminiClient aiClient;
    @InjectMocks SyllabusCourseAiSuggestionService service;

    private static final String MATERIAL = """
            ## Learning objective
            Understand why SQL JOIN combines rows from related tables.
            ## Explanation
            An INNER JOIN returns rows that match a condition in both tables. The matching
            columns usually represent an entity relationship, and explicit table aliases
            help readers identify which column belongs to which table.
            ## Example
            Join orders to customers on the customer identifier to display a customer's
            name beside each order. The result includes orders with matching customers.
            ## Practice
            Write a join query over two small tables, then explain which rows it returns.
            ## Self-check
            What happens to an order without a matching customer? It does not appear
            in an INNER JOIN result.
            """;

    private void source(List<Long> ids) {
        when(sourceService.preview(7L)).thenReturn(new Preview(7L, "DEMO-SQL", "SQL Basics", "Learn SQL",
                List.of(new SourceSection(10L, "SQL Querying", "Mission",
                        List.of(new SourceTopic(100L, "SELECT"), new SourceTopic(101L, "JOIN"))))));
        when(sourceService.validateTopicScope(7L, ids)).thenReturn(ids);
    }

    @Test void oneTopicCreatesOnlyTextWithRealLearningMaterial() {
        source(List.of(101L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1100))).thenReturn(MATERIAL);
        AiSuggestion result = service.generate(7L, new AiRequest(List.of(101L), "Try examples", null, false));
        assertEquals("SQL Basics - Course", result.name());
        assertEquals(List.of(101L), result.sections().getFirst().sourceTopicIds());
        assertEquals(List.of("JOIN"), result.sections().getFirst().lessons());
        assertEquals(List.of(LessonContentType.TEXT), result.sections().getFirst().lessonTypes());
        assertEquals(List.of(""), result.sections().getFirst().lessonUrls());
        assertEquals(List.of(MATERIAL.strip()), result.sections().getFirst().lessonMaterials());
        assertEquals("DISABLED", result.researchStatus());
    }

    @Test void selectedTopicsAreAllMappedAndMediaSearchIsSkipped() {
        source(List.of(100L, 101L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1100))).thenReturn(MATERIAL);
        AiSuggestion result = service.generate(7L, new AiRequest(List.of(100L, 101L), "", null, true));
        assertEquals(List.of(100L, 101L), result.sections().getFirst().sourceTopicIds());
        assertEquals(2, result.sections().getFirst().lessonMaterials().size());
        assertTrue(result.sections().getFirst().lessonTypes().stream().allMatch(v -> v == LessonContentType.TEXT));
        assertTrue(result.resources().isEmpty());
        verify(aiClient, times(2)).generateCourseText(anyString(), anyString(), eq(1100));
    }

    @Test void textGeneration503DoesNotReturnFakeSuggestion() {
        source(List.of(101L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1100)))
                .thenThrow(new BadRequestException("Gemini unavailable for text generation (HTTP 503)."));
        assertThrows(BadRequestException.class, () -> service.generate(7L,
                new AiRequest(List.of(101L), "", null, false)));
    }

    @Test void emptyOrNonEnglishTextIsRejectedRatherThanSaved() {
        source(List.of(101L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1100))).thenReturn("TODO");
        assertThrows(BadRequestException.class, () -> service.generate(7L,
                new AiRequest(List.of(101L), "", null, false)));
    }
}
