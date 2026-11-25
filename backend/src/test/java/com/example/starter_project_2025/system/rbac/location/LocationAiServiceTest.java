package com.example.starter_project_2025.system.rbac.location;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class LocationAiServiceTest {

    private final AiTextClient ai = mock(AiTextClient.class);
    private final LocationRepository locationRepository = mock(LocationRepository.class);
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final LocationAiService service =
            new LocationAiService(ai, locationRepository, objectMapper);

    @Test
    void reportsProviderFailureAndReturnsDeterministicFindings() {
        Location inactiveLocation = Location.builder()
                .id(1L)
                .code("LOC1")
                .name("Location 1")
                .status(LocationStatus.INACTIVE)
                .build();
        when(locationRepository.findAll()).thenReturn(List.of(inactiveLocation));
        when(ai.isConfigured()).thenReturn(true);
        when(ai.generateJson(anyString(), anyList(), eq(AiTextClient.ANALYSIS_TEMPERATURE)))
                .thenThrow(new BadRequestException("Gemini rate limit or quota exceeded."));

        LocationAiService.Analysis result = service.analyze();

        assertTrue(result.configured());
        assertFalse(result.aiUsed());
        assertEquals("Gemini rate limit or quota exceeded.", result.warning());
        assertFalse(result.findings().isEmpty());
    }

    @Test
    void marksValidProviderResponseAsAiAnalysis() throws Exception {
        when(locationRepository.findAll()).thenReturn(List.of());
        when(ai.isConfigured()).thenReturn(true);
        when(ai.generateJson(anyString(), anyList(), eq(AiTextClient.ANALYSIS_TEMPERATURE)))
                .thenReturn(objectMapper.readTree("""
                        {"summary":"Hierarchy analyzed.","findings":[]}
                        """));

        LocationAiService.Analysis result = service.analyze();

        assertTrue(result.configured());
        assertTrue(result.aiUsed());
        assertEquals("Hierarchy analyzed.", result.summary());
        assertNull(result.warning());
    }
}
