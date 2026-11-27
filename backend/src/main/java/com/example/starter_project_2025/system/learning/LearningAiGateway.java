package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.system.exam.ai.AiEssayGradingClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.io.IOException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.Semaphore;
import java.util.function.Function;

@Service
@RequiredArgsConstructor
@Slf4j
public class LearningAiGateway {
    private static final long COOLDOWN_NANOS = Duration.ofSeconds(30).toNanos();
    private final AiEssayGradingClient client;
    private final ObjectMapper mapper;
    private final Semaphore providerSlots = new Semaphore(4);
    // A null deadline represents an in-flight request.
    private final Map<Long, Long> nextRequestAt = new HashMap<>();

    public boolean isAvailable() {
        return client.isConfigured();
    }

    @PostConstruct
    void logConfiguration() {
        log.info("Learning AI configuration: configured={}, model={}. Backend settings: AI_ENABLED, GEMINI_API_KEY, AI_API_KEY.",
                client.isConfigured(), client.getModel());
    }

    public <T> T generate(Long userId, String prompt, Object evidence, Function<JsonNode, T> parse) {
        if (!isAvailable()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Learning AI is unavailable");
        }
        if (!providerSlots.tryAcquire()) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Learning AI is busy");
        }
        try {
            reserveRequest(userId);
            try {
                return parse.apply(requestWithRetry(prompt, mapper.writeValueAsString(evidence)));
            } catch (ResponseStatusException failure) {
                throw failure;
            } catch (RestClientResponseException failure) {
                int status = failure.getStatusCode().value();
                log.warn("Learning AI provider returned HTTP {}", status);
                String message = switch (status) {
                    case 400 -> "The AI provider rejected the request. Check the backend API key and model settings.";
                    case 401, 403 -> "The AI provider refused access. Check the backend API key and its permissions.";
                    case 404 -> "The configured AI model or endpoint was not found. Check AI_MODEL and AI_ENDPOINT on the backend.";
                    case 429 -> "The AI provider is rate-limiting requests. Check quota or try again later.";
                    case 500, 502, 503, 504 -> "The AI provider returned a temporary error (HTTP " + status
                            + "). Please try again or build a rule-based suggestion.";
                    default -> "The AI provider did not accept the request (HTTP " + status + ").";
                };
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, message);
            } catch (ResourceAccessException failure) {
                log.warn("Learning AI provider could not be reached or timed out");
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                        "The backend could not reach the AI provider or the request timed out. Try again later.");
            } catch (IOException | RuntimeException failure) {
                log.warn("Learning AI request failed ({})", failure.getClass().getSimpleName());
                throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "The AI provider did not return a valid response");
            } finally {
                finishRequest(userId);
            }
        } finally {
            providerSlots.release();
        }
    }

    private JsonNode requestWithRetry(String prompt, String input) throws IOException {
        throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Learning AI is temporarily unavailable; please use rule-based suggestion.");
    }

    private synchronized void reserveRequest(Long userId) {
        long now = System.nanoTime();
        nextRequestAt.values().removeIf(deadline -> deadline != null && deadline - now <= 0);
        if (nextRequestAt.containsKey(userId)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Wait before requesting another plan");
        }
        nextRequestAt.put(userId, null);
    }

    private synchronized void finishRequest(Long userId) {
        nextRequestAt.put(userId, System.nanoTime() + COOLDOWN_NANOS);
    }
}
