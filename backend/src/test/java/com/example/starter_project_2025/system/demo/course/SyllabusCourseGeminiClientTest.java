package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.service.ai.AiGradingProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SyllabusCourseGeminiClientTest {
    private SyllabusCourseGeminiClient client() {
        AiGradingProperties properties = new AiGradingProperties();
        properties.setModel("gemini-test-model");
        return new SyllabusCourseGeminiClient(properties, new ObjectMapper());
    }

    @Test void onlyPlainTextIsReturnedAndThinkingPartsAreIgnored() {
        String json = """
                {"candidates":[{"finishReason":"STOP","content":{"parts":[
                {"thought":true,"text":"hidden reasoning"},
                {"text":"## Objective\\nLearn SQL with one example."}]}}]}
                """;
        assertEquals("## Objective\nLearn SQL with one example.", client().parsePlainText(json));
    }

    @Test void truncatedResponseIsRejected() {
        String json = """
                {"candidates":[{"finishReason":"MAX_TOKENS","content":{"parts":[{"text":"short"}]}}]}
                """;
        assertThrows(BadRequestException.class, () -> client().parsePlainText(json));
    }

    @Test void defaultCourseModelUsesSharedModelUnlessExplicitlyOverridden() {
        assertEquals("gemini-test-model", client().resolvedModel());
    }
    @Test void fallbackIsExplicitAndDistinctFromPrimary() {
        var client = client();
        assertNull(client.fallbackModel());
        org.springframework.test.util.ReflectionTestUtils.setField(client, "fallbackModelOverride", "models/gemini-test-model");
        assertNull(client.fallbackModel());
        org.springframework.test.util.ReflectionTestUtils.setField(client, "fallbackModelOverride", "models/gemini-other-model");
        assertEquals("gemini-other-model", client.fallbackModel());
        org.springframework.test.util.ReflectionTestUtils.setField(client, "fallbackModelOverride", "invalid/model");
        assertThrows(BadRequestException.class, client::fallbackModel);
    }
    @Test void flash36UsesSuccessfulDiagnosticConfigWithoutTemperatureOverride() {
        var body = SyllabusCourseGeminiClient.requestBody("gemini-3.6-flash", "instruction", "topic", 4096);
        var config = (java.util.Map<?, ?>) body.get("generationConfig");
        assertEquals(4096, config.get("maxOutputTokens"));
        assertEquals(java.util.Map.of("thinkingLevel", "MINIMAL"), config.get("thinkingConfig"));
        assertFalse(config.containsKey("temperature"));
    }

    @Test void requestConfigIsModelSpecificAndPreservesLegacyModels() {
        var flash = (java.util.Map<?, ?>) SyllabusCourseGeminiClient.requestBody(
                "gemini-3.5-flash", "instruction", "topic", 2048).get("generationConfig");
        assertEquals(java.util.Map.of("thinkingLevel", "MINIMAL"), flash.get("thinkingConfig"));
        var legacy = (java.util.Map<?, ?>) SyllabusCourseGeminiClient.requestBody(
                "gemini-3.5-flash-lite", "instruction", "topic", 2048).get("generationConfig");
        assertFalse(legacy.containsKey("thinkingConfig"));
        assertEquals(0.3, legacy.get("temperature"));
        assertEquals(2048, legacy.get("maxOutputTokens"));
    }
}
