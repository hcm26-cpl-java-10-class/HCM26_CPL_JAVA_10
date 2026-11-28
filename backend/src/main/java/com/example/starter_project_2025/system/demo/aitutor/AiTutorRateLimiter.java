package com.example.starter_project_2025.system.demo.aitutor;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window limit on AI calls per user, so one learner cannot burn the shared Gemini quota.
 * In-memory (per instance), which is enough for a class-sized deployment.
 */
@Component
public class AiTutorRateLimiter {

    private final int maxCalls;
    private final Duration window;
    private final ConcurrentHashMap<Long, Deque<Instant>> calls = new ConcurrentHashMap<>();

    public AiTutorRateLimiter(
            @Value("${app.ai.tutor.max-calls-per-window:20}") int maxCalls,
            @Value("${app.ai.tutor.window-minutes:10}") long windowMinutes
    ) {
        this.maxCalls = maxCalls;
        this.window = Duration.ofMinutes(windowMinutes);
    }

    /** Records a call, or throws 429 when the user already used up the window. */
    public void check(Long userId, Instant now) {
        Deque<Instant> deque = calls.computeIfAbsent(userId, id -> new ArrayDeque<>());
        synchronized (deque) {
            Instant cutoff = now.minus(window);
            while (!deque.isEmpty() && deque.peekFirst().isBefore(cutoff)) {
                deque.pollFirst();
            }
            if (deque.size() >= maxCalls) {
                long wait = Math.max(1, Duration.between(now, deque.peekFirst().plus(window)).toSeconds());
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS,
                        "You are using the AI Tutor too fast. Please wait " + wait + " seconds");
            }
            deque.addLast(now);
        }
    }
}
