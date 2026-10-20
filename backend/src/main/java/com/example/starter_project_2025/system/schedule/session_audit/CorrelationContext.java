package com.example.starter_project_2025.system.schedule.session_audit;

import java.util.UUID;

/**
 * T2 / SRS §8.1 — Correlation ID của request hiện tại (NFR-OBS).
 *
 * <p>Được đặt bởi {@link CorrelationIdFilter}, dùng để đối chiếu response lỗi ↔ log.</p>
 */
public final class CorrelationContext {

    /** Header chuẩn trao đổi correlation ID. */
    public static final String HEADER = "X-Correlation-Id";

    /** Khóa MDC để log line luôn kèm correlation ID. */
    public static final String MDC_KEY = "correlationId";

    private static final int MAX_LENGTH = 100;
    private static final ThreadLocal<String> CURRENT = new ThreadLocal<>();

    private CorrelationContext() {
    }

    public static void set(String correlationId) {
        CURRENT.set(correlationId);
    }

    /**
     * @return correlation ID của request hiện tại, sinh mới (UUID) nếu chưa có.
     */
    public static String getOrCreate() {
        String current = CURRENT.get();
        if (current == null || current.isBlank()) {
            current = UUID.randomUUID().toString();
            CURRENT.set(current);
        }
        return current;
    }

    public static String get() {
        return CURRENT.get();
    }

    public static void clear() {
        CURRENT.remove();
    }

    /**
     * Chuẩn hóa giá trị client gửi lên: chỉ giữ ký tự an toàn, tối đa {@value #MAX_LENGTH} ký tự.
     *
     * @return giá trị hợp lệ hoặc {@code null} nếu không dùng được
     */
    public static String sanitize(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        StringBuilder builder = new StringBuilder(Math.min(trimmed.length(), MAX_LENGTH));
        for (int i = 0; i < trimmed.length() && builder.length() < MAX_LENGTH; i++) {
            char ch = trimmed.charAt(i);
            if (Character.isLetterOrDigit(ch) || ch == '-' || ch == '_' || ch == '.' || ch == ':') {
                builder.append(ch);
            }
        }
        return builder.isEmpty() ? null : builder.toString();
    }
}
