package com.example.starter_project_2025.system.i18n.service;

import org.slf4j.Logger;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Ngắt mạch (circuit breaker) đơn giản cho provider dịch bên ngoài.
 *
 * <p>Khi provider bị lỗi (đặc biệt là HTTP 429), tạm dừng gọi trong một khoảng thời gian
 * thay vì tiếp tục gọi và ghi log liên tục. Chỉ ghi đúng một dòng WARN khi bắt đầu tạm dừng.
 */
final class ProviderCooldown {

    private final String providerName;
    private final AtomicLong blockedUntilMillis = new AtomicLong(0);

    ProviderCooldown(String providerName) {
        this.providerName = providerName;
    }

    /** Provider đang trong thời gian tạm dừng hay không. */
    boolean isOpen() {
        return System.currentTimeMillis() < blockedUntilMillis.get();
    }

    /** Tạm dừng provider; chỉ log WARN nếu trước đó chưa bị tạm dừng. */
    void trip(Duration duration, String reason, Logger log) {
        long now = System.currentTimeMillis();
        long previous = blockedUntilMillis.getAndSet(now + duration.toMillis());
        if (previous <= now) {
            log.warn("[i18n] {} unavailable ({}). Paused for {} minute(s), falling back to other providers.",
                    providerName, reason, Math.max(1, duration.toMinutes()));
        }
    }
}
