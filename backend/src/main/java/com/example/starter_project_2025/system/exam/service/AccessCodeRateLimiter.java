package com.example.starter_project_2025.system.exam.service;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Rate limiter theo IP cho các endpoint public (verify access code).
 *
 * <p>Dùng sliding window cố định: mỗi IP được tối đa {@code maxRequests} lần trong mỗi cửa sổ
 * {@code windowMillis}. Dùng {@link ConcurrentHashMap} nên thread-safe.
 */
@Component
public class AccessCodeRateLimiter {

    private static final int DEFAULT_MAX_REQUESTS = 10;
    private static final long DEFAULT_WINDOW_MILLIS = 60_000L;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    private final int maxRequests;
    private final long windowMillis;

    public AccessCodeRateLimiter() {
        this(DEFAULT_MAX_REQUESTS, DEFAULT_WINDOW_MILLIS);
    }

    public AccessCodeRateLimiter(int maxRequests, long windowMillis) {
        this.maxRequests = maxRequests;
        this.windowMillis = windowMillis;
    }

    /**
     * Ghi nhận một lần truy cập.
     *
     * @return true nếu được phép, false nếu đã vượt giới hạn.
     */
    public boolean tryAcquire(String clientKey) {
        if (clientKey == null || clientKey.isBlank()) {
            clientKey = "unknown";
        }
        long now = System.currentTimeMillis();
        Window window = windows.compute(clientKey, (key, existing) -> {
            if (existing == null || now - existing.windowStart >= windowMillis) {
                return new Window(now, 1);
            }
            existing.count.incrementAndGet();
            return existing;
        });
        return window.count.get() <= maxRequests;
    }

    /**
     * @return số lượt còn lại trong cửa sổ hiện tại của client.
     */
    public int remaining(String clientKey) {
        if (clientKey == null || clientKey.isBlank()) {
            return 0;
        }
        Window window = windows.get(clientKey);
        if (window == null) {
            return maxRequests;
        }
        long now = System.currentTimeMillis();
        if (now - window.windowStart >= windowMillis) {
            return maxRequests;
        }
        return Math.max(0, maxRequests - window.count.get());
    }

    public void reset(String clientKey) {
        if (clientKey != null) {
            windows.remove(clientKey);
        }
    }

    public void clear() {
        windows.clear();
    }

    private static final class Window {
        private final long windowStart;
        private final AtomicInteger count;

        private Window(long windowStart, int count) {
            this.windowStart = windowStart;
            this.count = new AtomicInteger(count);
        }
    }
}
