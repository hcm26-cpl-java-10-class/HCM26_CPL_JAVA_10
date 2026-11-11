package com.example.starter_project_2025.system.demo.aicourse;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.service.ai.AiGradingProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Small multi-turn Gemini client that returns JSON.
 * Reuses the existing app.ai.* settings (GEMINI_API_KEY, AI_MODEL, AI_ENDPOINT) so no new config is needed.
 * Outline generation is longer than essay grading, so the timeout is at least 60s.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AiTextClient {

    private static final int MIN_TIMEOUT_SECONDS = 60;

    private final AiGradingProperties properties;
    private final ObjectMapper objectMapper;

    /** role = "user" | "assistant" (mapped to Gemini's "model"). */
    public record Turn(String role, String text) {
    }

    public boolean isConfigured() {
        return properties.isEnabled()
                && properties.getApiKey() != null
                && !properties.getApiKey().isBlank();
    }

    public JsonNode generateJson(String systemInstruction, List<Turn> turns) {
        if (!isConfigured()) {
            throw new BadRequestException(
                    "Gemini API key is not configured. Set GEMINI_API_KEY in backend/.env to use the AI course builder.");
        }

        List<Map<String, Object>> contents = new ArrayList<>();
        for (Turn turn : turns) {
            contents.add(Map.of(
                    "role", "assistant".equalsIgnoreCase(turn.role()) ? "model" : "user",
                    "parts", List.of(Map.of("text", turn.text()))
            ));
        }

        Map<String, Object> body = Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", systemInstruction))),
                "contents", contents,
                "generationConfig", Map.of(
                        "responseMimeType", "application/json",
                        "temperature", 0.7,
                        "maxOutputTokens", 8192
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", properties.getApiKey().trim());

        // Up to 3 attempts: Gemini sometimes answers 5xx (overloaded) or returns truncated JSON.
        final int maxAttempts = 3;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                ResponseEntity<String> response = buildRestTemplate()
                        .postForEntity(generateContentUrl(), new HttpEntity<>(body, headers), String.class);
                if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                    throw new BadRequestException("AI provider returned status " + response.getStatusCode());
                }
                return parse(response.getBody());
            } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
                throw new BadRequestException("Gemini API key is invalid or unauthorized.");
            } catch (HttpClientErrorException.TooManyRequests e) {
                throw new BadRequestException("Gemini rate limit or quota exceeded. Please wait a moment and try again.");
            } catch (HttpClientErrorException.NotFound e) {
                throw new BadRequestException("Gemini model not found. Check AI_MODEL in backend/.env.");
            } catch (HttpClientErrorException e) {
                log.error("Gemini returned {}: {}", e.getStatusCode(), e.getResponseBodyAsString());
                throw new BadRequestException("AI provider request failed (HTTP " + e.getStatusCode().value() + ").");
            } catch (HttpServerErrorException e) {
                log.warn("Gemini returned {} (attempt {}/{})", e.getStatusCode(), attempt, maxAttempts);
                if (attempt == maxAttempts) {
                    throw new BadRequestException(
                            "The AI service is busy right now (HTTP " + e.getStatusCode().value() + "). Please try again in a minute.");
                }
                pause(attempt * 2000L);   // 2s, then 4s
            } catch (ResourceAccessException e) {
                throw new BadRequestException("AI provider timed out. Please try again.");
            } catch (InvalidAiJsonException e) {
                log.warn("Attempt {} returned invalid JSON: {}", attempt, e.getMessage());
                if (attempt == maxAttempts) {
                    throw new BadRequestException("The AI returned an unreadable answer. Please try again.");
                }
            }
        }
        throw new BadRequestException("The AI returned an unreadable answer. Please try again.");
    }

    private static void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private JsonNode parse(String responseJson) {
        try {
            JsonNode parts = objectMapper.readTree(responseJson)
                    .path("candidates").path(0).path("content").path("parts");
            if (!parts.isArray() || parts.isEmpty()) {
                throw new InvalidAiJsonException("missing candidates/parts");
            }
            String text = parts.get(0).path("text").asText("").trim();
            if (text.startsWith("```")) {
                text = text.replaceFirst("^```(?:json)?", "").replaceFirst("```$", "").trim();
            }
            return objectMapper.readTree(text);
        } catch (InvalidAiJsonException e) {
            throw e;
        } catch (Exception e) {
            throw new InvalidAiJsonException(e.getMessage());
        }
    }

    private String generateContentUrl() {
        String base = properties.getEndpoint() == null || properties.getEndpoint().isBlank()
                ? "https://generativelanguage.googleapis.com/v1beta/models"
                : properties.getEndpoint().trim().replaceAll("/+$", "");
        if (base.contains(":generateContent")) {
            return base;
        }
        String model = properties.getModel().trim();
        if (model.startsWith("models/")) {
            model = model.substring("models/".length());
        }
        return (base.endsWith("/models") ? base : base + "/models") + "/" + model + ":generateContent";
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = Math.max(MIN_TIMEOUT_SECONDS, properties.getTimeoutSeconds()) * 1000;
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return new RestTemplate(factory);
    }

    private static class InvalidAiJsonException extends RuntimeException {
        InvalidAiJsonException(String message) {
            super(message);
        }
    }
}