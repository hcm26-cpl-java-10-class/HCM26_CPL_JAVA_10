package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SyllabusCourseAiJobServiceTest {
    private final CourseFromSyllabusService sourceService = mock(CourseFromSyllabusService.class);
    private final SyllabusCourseGeminiClient aiClient = mock(SyllabusCourseGeminiClient.class);
    private final SyllabusCourseAiJobService jobs = new SyllabusCourseAiJobService(sourceService, aiClient);

    private static final String MATERIAL = """
            ## Learning objective
            Learn the purpose of DNS in a modern web application.
            ## Explanation
            DNS translates human-friendly hostnames into address records that a client
            can use to contact a server. A resolver queries authoritative information
            and caches answers for a limited time to reduce repeat lookups.
            ## Worked example
            Look up the address of a sample website and compare the answer with the
            hostname that appears in an HTTP request. These represent different
            stages of connecting to the same online service.
            ## Exercise
            Inspect DNS results for two known hostnames and explain why they may differ.
            ## Self-check
            Does DNS itself download the HTML page? No. It helps locate the endpoint;
            an application protocol such as HTTPS handles the page request.
            """;

    @Test void batchParserKeepsOnlyCompleteUnambiguousEntries() {
        var result = SyllabusCourseAiJobService.parseBatch("<<<LESSON 2>>>\n" + MATERIAL
                + "\n<<<END 2>>>\n<<<LESSON 1>>>\nunfinished", 2);
        assertEquals(java.util.Set.of(2), result.keySet());
        assertEquals(MATERIAL.strip(), result.get(2));
        String repeated = "<<<LESSON 1>>>\n" + MATERIAL + "\n<<<END 1>>>\n";
        assertTrue(SyllabusCourseAiJobService.parseBatch(repeated + repeated, 2).isEmpty());
    }

    @Test void focusedJobUsesOnlySelectedTopicsAndBatchesWithinSection() throws Exception {
        when(sourceService.preview(16L)).thenReturn(new Preview(16L, "SYL-WEB", "Web Development", "",
                List.of(new SourceSection(20L, "Foundations of Web", "", List.of(
                        new SourceTopic(100L, "DNS"), new SourceTopic(101L, "HTML"), new SourceTopic(102L, "CSS"))),
                        new SourceSection(21L, "Backend", "", List.of(new SourceTopic(103L, "REST"))))));
        when(sourceService.validateTopicScope(16L, List.of(100L, 102L))).thenReturn(List.of(100L, 102L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1000))).thenReturn("NONE");
        when(aiClient.generateCourseText(anyString(), anyString(), eq(4096))).thenReturn(
                "<<<LESSON 1>>>\n" + MATERIAL + "\n<<<END 1>>>\n<<<LESSON 2>>>\n" + MATERIAL + "\n<<<END 2>>>");
        var started = jobs.start(16L, new AiRequest(List.of(100L, 102L), "", null, false), "educatorA");
        var result = started;
        for (int i = 0; i < 200 && ("QUEUED".equals(result.status()) || "RUNNING".equals(result.status())); i++) {
            Thread.sleep(100);
            result = jobs.view(16L, started.jobId(), "educatorA");
        }
        assertEquals("COMPLETED", result.status());
        assertEquals(2, result.done());
        assertEquals(1, result.suggestion().sections().size());
        assertEquals(List.of(100L, 102L), result.suggestion().sections().getFirst().sourceTopicIds());
        verify(aiClient, never()).generateCourseText(anyString(), anyString(), eq(2048));
    }

    @AfterEach void shutdown() { jobs.shutdown(); }

    @Test void oneClickCreatesUnsavedSuggestionWithOriginalTopicsAndMaterials() throws Exception {
        when(sourceService.preview(16L)).thenReturn(new Preview(16L, "SYL-WEB", "Web Development", "",
                List.of(new SourceSection(20L, "Foundations of Web", "",
                        List.of(new SourceTopic(100L, "DNS and HTTP"))))));
        when(sourceService.validateTopicScope(16L, List.of(100L))).thenReturn(List.of(100L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1000))).thenReturn("NONE");
        when(aiClient.generateCourseText(anyString(), anyString(), eq(2048))).thenReturn(MATERIAL);

        var started = jobs.start(16L, new AiRequest(List.of(100L), "", null, false), "educatorA");
        assertNotNull(started.jobId());
        assertThrows(BadRequestException.class, () -> jobs.view(16L, started.jobId(), "educatorB"));
        SyllabusCourseAiJobService.JobView result = started;
        for (int i = 0; i < 150 && ("QUEUED".equals(result.status()) || "RUNNING".equals(result.status())); i++) {
            Thread.sleep(100);
            result = jobs.view(16L, started.jobId(), "educatorA");
        }
        assertEquals("COMPLETED", result.status());
        assertEquals(1, result.done());
        assertEquals(1, result.total());
        assertTrue(result.suggestion().sections().getFirst().lessonDurations().getFirst() > 0);
        assertEquals(List.of(100L), result.suggestion().sections().getFirst().sourceTopicIds());
        assertTrue(result.suggestion().sections().getFirst().lessonMaterials().getFirst().length() >= 220);
        verify(aiClient).generateCourseText(anyString(), anyString(), eq(1000));
        verify(aiClient).generateCourseText(anyString(), anyString(), eq(2048));
    }
    @Test void mixedPlanAddsHeadingsWithoutExtraTextRequests() throws Exception {
        when(sourceService.preview(16L)).thenReturn(new Preview(16L, "SYL-WEB", "Web Development", "",
                List.of(new SourceSection(20L, "Foundations of Web", "", List.of(new SourceTopic(100L, "DNS"))))));
        when(sourceService.validateTopicScope(16L, List.of(100L))).thenReturn(List.of(100L));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(2048))).thenReturn(MATERIAL);
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1000))).thenReturn(
                "LESSON|1|1|DNS demonstration|VIDEO\nLESSON|1|1|DNS knowledge check|QUIZ");
        var started = jobs.start(16L, new AiRequest(List.of(100L), "", null, false), "educatorA");
        var result = started;
        for (int i = 0; i < 200 && ("QUEUED".equals(result.status()) || "RUNNING".equals(result.status())); i++) {
            Thread.sleep(100);
            result = jobs.view(16L, started.jobId(), "educatorA");
        }
        assertEquals("COMPLETED", result.status());
        assertEquals(3, result.done());
        var section = result.suggestion().sections().getFirst();
        assertEquals(List.of(100L, 100L, 100L), section.sourceTopicIds());
        assertEquals(List.of("TEXT", "VIDEO", "QUIZ"), section.lessonTypes().stream().map(Enum::name).toList());
        assertEquals(List.of("", ""), section.lessonMaterials().subList(1, 3));
        assertTrue(section.lessonDurations().stream().allMatch(d -> d > 0));
        verify(aiClient, times(2)).generateCourseText(anyString(), anyString(), anyInt());
    }
    @Test void overloadSplitsBatchAndKeepsSmallerRequestsForRemainingTopics() throws Exception {
        when(sourceService.preview(16L)).thenReturn(new Preview(16L, "SYL-WEB", "Web Development", "",
                List.of(new SourceSection(20L, "Foundations of Web", "", List.of(
                        new SourceTopic(100L, "DNS"), new SourceTopic(101L, "HTML"),
                        new SourceTopic(102L, "CSS"), new SourceTopic(103L, "HTTP"))))));
        var selected = List.of(100L, 101L, 102L, 103L);
        when(sourceService.validateTopicScope(16L, selected)).thenReturn(selected);
        when(aiClient.generateCourseText(anyString(), anyString(), eq(4096))).thenThrow(
                new SyllabusCourseGeminiClient.TemporarilyUnavailableException("HTTP 503"));
        when(aiClient.generateCourseText(anyString(), anyString(), eq(2048))).thenReturn(MATERIAL);
        when(aiClient.generateCourseText(anyString(), anyString(), eq(1000))).thenReturn("NONE");
        var started = jobs.start(16L, new AiRequest(selected, "", null, false), "educatorA");
        var result = started;
        for (int i = 0; i < 100 && ("QUEUED".equals(result.status()) || "RUNNING".equals(result.status())); i++) {
            Thread.sleep(20);
            result = jobs.view(16L, started.jobId(), "educatorA");
        }
        assertEquals("COMPLETED", result.status());
        assertEquals(selected, result.suggestion().sections().getFirst().sourceTopicIds());
        verify(aiClient, times(1)).generateCourseText(anyString(), anyString(), eq(4096));
        verify(aiClient, times(4)).generateCourseText(anyString(), anyString(), eq(2048));
    }
}
