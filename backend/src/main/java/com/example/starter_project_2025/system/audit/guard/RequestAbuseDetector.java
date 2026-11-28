package com.example.starter_project_2025.system.audit.guard;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Sliding-window counters per caller. Keeps everything in memory: it only needs to notice bursts,
 * the persistent record is the {@link SecurityAlert} raised from a detection.
 */
@Component
public class RequestAbuseDetector {

    public record Detection(String type, int count, int windowSeconds) {
    }

    private static final class Window {
        final Deque<Long> requests = new ArrayDeque<>();
        final Deque<Long> denied = new ArrayDeque<>();
    }

    private final ConcurrentHashMap<String, Window> windows = new ConcurrentHashMap<>();

    private final int maxRequests;
    private final long requestWindowMs;
    private final int maxDenied;
    private final long deniedWindowMs;

    public RequestAbuseDetector(
            @Value("${app.security.rate-limit.max-requests:120}") int maxRequests,
            @Value("${app.security.rate-limit.window-seconds:10}") int requestWindowSeconds,
            @Value("${app.security.denied.max-attempts:15}") int maxDenied,
            @Value("${app.security.denied.window-seconds:300}") int deniedWindowSeconds
    ) {
        this.maxRequests = maxRequests;
        this.requestWindowMs = requestWindowSeconds * 1000L;
        this.maxDenied = maxDenied;
        this.deniedWindowMs = deniedWindowSeconds * 1000L;
    }

    /** Records one finished request and returns a detection when a threshold was just crossed. */
    public Optional<Detection> record(String key, int status) {
        long now = System.currentTimeMillis();
        Window window = windows.computeIfAbsent(key, k -> new Window());

        synchronized (window) {
            window.requests.addLast(now);
            trim(window.requests, now - requestWindowMs);

            if (status == 401 || status == 403) {
                window.denied.addLast(now);
            }
            trim(window.denied, now - deniedWindowMs);

            if (window.requests.size() > maxRequests) {
                int count = window.requests.size();
                window.requests.clear();
                return Optional.of(new Detection(
                        SecurityAlert.TYPE_RATE_LIMIT, count, (int) (requestWindowMs / 1000)));
            }

            if (window.denied.size() >= maxDenied) {
                int count = window.denied.size();
                window.denied.clear();
                return Optional.of(new Detection(
                        SecurityAlert.TYPE_REPEATED_DENIED, count, (int) (deniedWindowMs / 1000)));
            }
        }

        return Optional.empty();
    }

    private static void trim(Deque<Long> times, long cutoff) {
        while (!times.isEmpty() && times.peekFirst() < cutoff) {
            times.pollFirst();
        }
    }

    @Scheduled(fixedRate = 60_000)
    public void prune() {
        long now = System.currentTimeMillis();
        long keep = Math.max(requestWindowMs, deniedWindowMs);

        windows.entrySet().removeIf(entry -> {
            Window window = entry.getValue();
            synchronized (window) {
                Long lastRequest = window.requests.peekLast();
                Long lastDenied = window.denied.peekLast();
                long last = Math.max(lastRequest != null ? lastRequest : 0L,
                        lastDenied != null ? lastDenied : 0L);
                return now - last > keep;
            }
        });
    }
}
