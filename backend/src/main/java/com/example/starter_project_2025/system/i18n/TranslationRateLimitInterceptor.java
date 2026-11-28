package com.example.starter_project_2025.system.i18n;

import com.example.starter_project_2025.exception.error.I18nErrorResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Giới hạn số request dịch mà một IP được gọi trong một phút.
 *
 * <p>Endpoint dịch là public nên cần chống lạm dụng: quá giới hạn thì trả 429, frontend
 * giữ nguyên source text và thử lại ở lần render sau.
 *
 * <p>Map được giới hạn tối đa {@value MAX_TRACKED_CLIENTS} IP và được dọn định kỳ mỗi 5 phút
 * để tránh memory leak khi có nhiều IP unique.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TranslationRateLimitInterceptor implements HandlerInterceptor {

    private static final long WINDOW_MILLIS = 60_000;

    /** Số giây client nên chờ trước khi thử lại. */
    private static final int RATE_LIMIT_RETRY_AFTER_SECONDS = 60;

    /** Số IP tối đa được lưu cùng lúc; nếu vượt quá thì bỏ qua rate limit cho IP mới. */
    private static final int MAX_TRACKED_CLIENTS = 10_000;

    private final I18nProperties properties;

    private final ObjectMapper objectMapper;

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    @Override
    public boolean preHandle(
            HttpServletRequest request,
            HttpServletResponse response,
            Object handler
    ) {
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }
        int limit = properties.getRateLimitPerMinute();
        if (limit <= 0) {
            return true;
        }

        String client = resolveClient(request);
        long now = Instant.now().toEpochMilli();

        // Nếu map đã đầy và IP này chưa được track, bỏ qua rate limit để không OOM.
        if (!windows.containsKey(client) && windows.size() >= MAX_TRACKED_CLIENTS) {
            log.warn("[i18n] Rate-limit map full ({} IPs); skipping limit check for new client", MAX_TRACKED_CLIENTS);
            return true;
        }

        Window window = windows.compute(client, (key, existing) -> {
            if (existing == null || now - existing.startedAt() >= WINDOW_MILLIS) {
                return new Window(now, 1);
            }
            return new Window(existing.startedAt(), existing.count() + 1);
        });

        if (window.count() > limit) {
            writeRateLimited(response);
            return false;
        }
        return true;
    }

    /**
     * Trả lỗi 429 với body chuẩn {@link I18nErrorResponse} và header {@code Retry-After}.
     *
     * <p>Trước đây response 429 rỗng khiến frontend không đọc được mã lỗi, chỉ biết là lỗi
     * mạng chung chung.
     */
    private void writeRateLimited(HttpServletResponse response) {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.setHeader("Retry-After", String.valueOf(RATE_LIMIT_RETRY_AFTER_SECONDS));

        I18nErrorResponse body = new I18nErrorResponse(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                "ERR_I18N_RATE_LIMITED",
                "Too many translation requests, please retry later.",
                java.time.LocalDateTime.now());
        try {
            response.getWriter().write(objectMapper.writeValueAsString(body));
            response.flushBuffer();
        } catch (java.io.IOException ex) {
            log.warn("[i18n] Cannot write rate-limit response: {}", ex.getMessage());
        }
    }

    /**
     * Dọn dẹp các window đã hết hạn mỗi 5 phút để tránh memory leak.
     */
    @Scheduled(fixedDelay = 300_000)
    public void evictExpiredWindows() {
        long threshold = Instant.now().toEpochMilli() - WINDOW_MILLIS;
        int before = windows.size();
        windows.entrySet().removeIf(entry -> entry.getValue().startedAt() < threshold);
        int removed = before - windows.size();
        if (removed > 0) {
            log.debug("[i18n] Rate-limit cleanup: removed {} expired window(s), {} remaining", removed, windows.size());
        }
    }

    private static String resolveClient(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record Window(long startedAt, int count) {
    }
}
