package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.service.ai.AiGradingProperties;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Dedicated plain-text client for Create Course from Syllabus only.
 *
 * It never changes the JSON call path used by Curriculum, Syllabus Templates,
 * and other team features. By default it uses the same configured Gemini model
 * and API key. Optional AI_COURSE_MODEL lets course jobs use another *supported*
 * model without changing the rest of the LMS; model availability is not assumed.
 *
 * Request count is bounded: at most two attempts per logical request.
 * Every physical request is paced, including fallback and retries.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SyllabusCourseGeminiClient {
    private final AiGradingProperties properties;
    private final ObjectMapper objectMapper;

    @Value("${AI_COURSE_MODEL:}")
    private String courseModelOverride = "";

    @Value("${AI_COURSE_FALLBACK_MODEL:}")
    private String fallbackModelOverride = "";
    private long lastPhysicalCallStart;
    private volatile long fallbackPreferredUntil;
    private static final long MIN_CALL_INTERVAL_NANOS = TimeUnit.MILLISECONDS.toNanos(5500);

    static class TemporarilyUnavailableException extends BadRequestException {
        TemporarilyUnavailableException(String message) { super(message); }
    }

    static class IncompleteResponseException extends BadRequestException {
        final String partialText;
        IncompleteResponseException(String message) { this(message, ""); }
        IncompleteResponseException(String message, String partialText) { super(message); this.partialText = partialText; }
    }

    public String generateCourseText(String instruction, String topicContext, int maxOutputTokens) {
        if (maxOutputTokens < 256 || maxOutputTokens > 4096) {
            throw new IllegalArgumentException("Course text token budget must be 256..4096");
        }
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            throw new BadRequestException("Gemini API key is not configured in backend/.env.");
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("x-goog-api-key", properties.getApiKey().trim());

        String primary = resolvedModel();
        String fallback = fallbackModel();
        boolean preferFallback = fallback != null && fallbackPreferredUntil != 0 && System.nanoTime() - fallbackPreferredUntil < 0;
        String first = preferFallback ? fallback : primary;
        String second = fallback == null ? primary : (preferFallback ? primary : fallback);
        // On batch overload, reduce the workload instead of repeating the same large request.
        int attempts = fallback == null && maxOutputTokens >= 3000 ? 1 : 2;
        for (int attempt = 1; attempt <= attempts; attempt++) {
            String model = attempt == 1 ? first : second;
            try {
                String url = generateContentUrl(model);
                Map<String, Object> body = requestBody(model, instruction, topicContext, maxOutputTokens);
                pacePhysicalRequest();
                log.info("Course Gemini request: model={}, thinking={}, maxOutputTokens={}",
                        model, usesMinimalThinking(model) ? "MINIMAL" : "model default", maxOutputTokens);
                ResponseEntity<String> response = buildRestTemplate().postForEntity(
                        url, new HttpEntity<>(body, headers), String.class);
                if (response.getBody() == null || response.getBody().isBlank()) {
                    throw new IncompleteResponseException("Gemini returned an empty text response.");
                }
                String result = parsePlainText(response.getBody());
                if (result.isBlank()) throw new IncompleteResponseException("Gemini returned no lesson text.");
                if (fallback != null && fallback.equals(model)) {
                    fallbackPreferredUntil = System.nanoTime() + TimeUnit.SECONDS.toNanos(90);
                } else {
                    fallbackPreferredUntil = 0;
                }
                return result;
            } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden ex) {
                throw new BadRequestException("Gemini API key is invalid or unauthorized.");
            } catch (HttpClientErrorException.TooManyRequests ex) {
                throw new BadRequestException("Gemini rate limit or quota exceeded (HTTP 429). Check quota and retry remaining Lessons after the limit resets.");
            } catch (HttpClientErrorException.NotFound ex) {
                throw new BadRequestException("Gemini Course model not found. Check AI_COURSE_MODEL or AI_MODEL.");
            } catch (HttpClientErrorException ex) {
                throw new BadRequestException("Gemini Course request failed (HTTP " + ex.getStatusCode().value() + ").");
            } catch (HttpServerErrorException ex) {
                int code = ex.getStatusCode().value();
                log.warn("Course Gemini model {} returned HTTP {} (attempt {}/{})", model, code, attempt, attempts);
                if (code != 500 && code != 502 && code != 503 && code != 504) {
                    throw new BadRequestException("Gemini Course request failed (HTTP " + code + ").");
                }
                pause(2000); // short backoff after a transient server error, even before batch splitting
                if (attempt == attempts) {
                    throw new TemporarilyUnavailableException("Gemini unavailable for Course text generation (HTTP "
                            + code + "). Retry remaining Lessons later.");
                }
            } catch (ResourceAccessException ex) {
                log.warn("Course Gemini model {} connection failed (attempt {}/{})", model, attempt, attempts);
                pause(2000);
                if (attempt == attempts) throw new TemporarilyUnavailableException("Gemini Course text request timed out.");
            }
        }
        throw new BadRequestException("Gemini Course text generation is unavailable.");
    }

    // Match the successful V2 diagnostic for the explicitly tested Flash model family.
    // Build per attempt: the fallback model may accept different generation settings.
    static boolean usesMinimalThinking(String model) {
        return "gemini-3.6-flash".equals(model) || "gemini-3.5-flash".equals(model);
    }

    static Map<String, Object> requestBody(String model, String instruction, String topicContext, int maxOutputTokens) {
        Map<String, Object> generationConfig = usesMinimalThinking(model)
                ? Map.of("maxOutputTokens", maxOutputTokens, "thinkingConfig", Map.of("thinkingLevel", "MINIMAL"))
                : Map.of("maxOutputTokens", maxOutputTokens, "temperature", 0.3);
        return Map.of(
                "systemInstruction", Map.of("parts", List.of(Map.of("text", instruction))),
                "contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", topicContext)))),
                "generationConfig", generationConfig
        );
    }

    String parsePlainText(String responseJson) {
        try {
            JsonNode candidate = objectMapper.readTree(responseJson).path("candidates").path(0);
            String finish = candidate.path("finishReason").asText("");
            if (!finish.isBlank() && !"STOP".equals(finish) && !"MAX_TOKENS".equals(finish)) {
                throw new BadRequestException("Gemini did not complete the Course response (" + finish + ").");
            }
            StringBuilder text = new StringBuilder();
            for (JsonNode part : candidate.path("content").path("parts")) {
                if (part.path("thought").asBoolean(false)) continue;
                String piece = part.path("text").asText("");
                if (!piece.isBlank()) text.append(piece);
            }
            if ("MAX_TOKENS".equals(finish)) {
                throw new IncompleteResponseException("Gemini ended the text before the Lesson was complete.", text.toString());
            }
            return text.toString().strip();
        } catch (JsonProcessingException ex) {
            throw new IncompleteResponseException("Gemini returned an unreadable Course text response.");
        }
    }

    String resolvedModel() {
        String configured = courseModelOverride != null && !courseModelOverride.isBlank()
                ? courseModelOverride.strip() : properties.getModel();
        if (configured == null || configured.isBlank()) {
            throw new BadRequestException("No Gemini model configured for Course generation.");
        }
        String model = configured.strip().replaceFirst("^models/", "");
        if (!model.matches("[A-Za-z0-9_.-]+")) throw new BadRequestException("Invalid Gemini Course model name.");
        return model;
    }

    String fallbackModel() {
        if (fallbackModelOverride == null || fallbackModelOverride.isBlank()) return null;
        String model = fallbackModelOverride.strip().replaceFirst("^models/", "");
        if (!model.matches("[A-Za-z0-9_.-]+")) throw new BadRequestException("Invalid AI_COURSE_FALLBACK_MODEL.");
        return model.equals(resolvedModel()) ? null : model;
    }

    private String generateContentUrl(String model) {
        String base = properties.getEndpoint() == null || properties.getEndpoint().isBlank()
                ? "https://generativelanguage.googleapis.com/v1beta/models"
                : properties.getEndpoint().strip().replaceAll("/+$", "");
        // Avoid modifying a custom endpoint intended for an alternate provider.
        if (base.contains(":generateContent")) {
            if ((courseModelOverride != null && !courseModelOverride.isBlank()) || fallbackModel() != null) {
                throw new BadRequestException("Course model overrides cannot be used with a fixed AI_ENDPOINT.");
            }
            return base;
        }
        return (base.endsWith("/models") ? base : base + "/models")
                + "/" + model + ":generateContent";
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(Math.max(60, Math.min(120, properties.getTimeoutSeconds())) * 1000);
        return new RestTemplate(factory);
    }

    private synchronized void pacePhysicalRequest() {
        long remaining = MIN_CALL_INTERVAL_NANOS - (System.nanoTime() - lastPhysicalCallStart);
        if (lastPhysicalCallStart != 0 && remaining > 0) pause((remaining + 999_999) / 1_000_000);
        lastPhysicalCallStart = System.nanoTime();
    }

    private static void pause(long millis) {
        try { Thread.sleep(millis); }
        catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new BadRequestException("Course AI request was interrupted.");
        }
    }
}
