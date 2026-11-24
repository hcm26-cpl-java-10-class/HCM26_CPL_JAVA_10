package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import com.example.starter_project_2025.system.exam.dto.PublishedExamScoreDTO;
import com.example.starter_project_2025.system.exam.service.PublishedExamScoreService;
import com.example.starter_project_2025.system.exam.service.ai.AiEssayGradingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class LearningInsightsTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AiEssayGradingClient provider = mock(AiEssayGradingClient.class);
    private final LearningPlanService plans = new LearningPlanService(new LearningAiGateway(provider, mapper));

    @Test
    void onlyPublishedScoresContributeToInsightsAndRecommendation() {
        var scores = mock(PublishedExamScoreService.class);
        var service = new LearningInsightsService(mock(CourseEnrollmentService.class),
                mock(LessonProgressService.class), scores);
        when(scores.findMyPublishedScores(9L)).thenReturn(List.of(
                score(1L, "Unpublished", 0, 10, false),
                score(2L, "Java", 40, 100, true),
                score(3L, "SQL", 5, 10, true)));

        var snapshot = service.snapshot(9L, false, true);

        assertEquals(List.of(2L, 3L), snapshot.recentExamResults().stream()
                .map(LearningInsightsService.ExamResult::examId).toList());
        assertTrue(service.nextStep(snapshot).contains("Java"));
        assertFalse(service.snapshot(9L, false, false).hasEvidence());
        verify(scores, times(1)).findMyPublishedScores(9L);
    }

    @Test
    void sendsOnlyBoundedStudyEvidenceAndThrottlesRepeatRequests() throws Exception {
        when(provider.isConfigured()).thenReturn(true);
        when(provider.requestJson(anyString(), anyString())).thenReturn(mapper.readTree("""
                {"summary":"Continue Java practice.","steps":["Finish one Java lesson."]}
                """));

        assertEquals(List.of("Finish one Java lesson."), plans.generate(9L, courseSnapshot()).steps());
        assertEquals(HttpStatus.TOO_MANY_REQUESTS,
                assertThrows(ResponseStatusException.class, () -> plans.generate(9L, courseSnapshot())).getStatusCode());

        var input = ArgumentCaptor.forClass(String.class);
        verify(provider).requestJson(anyString(), input.capture());
        assertEquals(mapper.readTree("""
                {"courses":[{"title":"Java","completedLessons":1,"totalLessons":3}],"recentPublishedExams":[]}
                """), mapper.readTree(input.getValue()));
    }

    @Test
    void malformedAiResponseIsReportedAsUnavailable() throws Exception {
        when(provider.isConfigured()).thenReturn(true);
        when(provider.requestJson(anyString(), anyString()))
                .thenReturn(mapper.readTree("{\"summary\":\"Continue learning.\",\"steps\":[{}]}"));

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE,
                assertThrows(ResponseStatusException.class, () -> plans.generate(9L, courseSnapshot())).getStatusCode());
    }

    @Test
    void retriesOneTransientProviderFailure() throws Exception {
        when(provider.isConfigured()).thenReturn(true);
        when(provider.requestJson(anyString(), anyString()))
                .thenThrow(new HttpServerErrorException(HttpStatus.SERVICE_UNAVAILABLE))
                .thenReturn(mapper.readTree("""
                        {"summary":"Continue learning.","steps":["Finish one Java lesson."]}
                        """));

        assertEquals(List.of("Finish one Java lesson."), plans.generate(9L, courseSnapshot()).steps());
        verify(provider, times(2)).requestJson(anyString(), anyString());
    }

    @Test
    void missingEvidenceDoesNotCallProvider() {
        var empty = new LearningInsightsService.Snapshot(0, List.of(), List.of(), true, true);
        assertEquals(HttpStatus.BAD_REQUEST,
                assertThrows(ResponseStatusException.class, () -> plans.generate(9L, empty)).getStatusCode());
        verifyNoInteractions(provider);
    }

    private LearningInsightsService.Snapshot courseSnapshot() {
        return new LearningInsightsService.Snapshot(1,
                List.of(new LearningInsightsService.CourseProgress(42L, "Java", 1, 3)),
                List.of(), true, false);
    }

    private PublishedExamScoreDTO score(long id, String title, int value, int max, boolean published) {
        return new PublishedExamScoreDTO(id, title, 1, null, BigDecimal.valueOf(value), BigDecimal.valueOf(max),
                null, null, Instant.EPOCH, id, published);
    }
}
