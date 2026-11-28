package com.example.starter_project_2025.system.i18n;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cấu hình cho tầng dịch tự động (auto-translation).
 *
 * <p>Tầng dịch tự động dùng dịch vụ Google Translate (public endpoint) làm nguồn dịch
 * và lưu cache vào database để giảm số lần gọi ra ngoài.
 */
@ConfigurationProperties(prefix = "app.i18n")
@Getter
@Setter
public class I18nProperties {

    /** Bật/tắt tầng dịch tự động. */
    private boolean enabled = true;

    /**
     * Provider dịch được dùng, phân tách bằng dấu {@code +} theo thứ tự ưu tiên.
     *
     * <p>Giá trị hợp lệ: {@code google}, {@code mymemory}, {@code google+mymemory} (mặc định).
     * Cấu hình này là điểm cắm để đổi engine dịch mà không phải sửa code service.
     */
    private String provider = "google+mymemory";

    /** Địa chỉ endpoint Google Translate. */
    private String endpoint = "https://translate.googleapis.com/translate_a/single";

    /** Địa chỉ endpoint MyMemory (provider dự phòng). */
    private String myMemoryEndpoint = "https://api.mymemory.translated.net/get";

    /** Thời gian chờ tối đa cho một lần gọi (mili giây). */
    private int timeoutMs = 10_000;

    /** Số chuỗi tối đa gửi trong một request (để tránh URL quá dài). */
    private int maxBatchSize = 40;

    /** Số chuỗi tối đa mà frontend được gửi trong một request. */
    private int maxTextsPerRequest = 200;

    /** Độ dài tối đa của một chuỗi được dịch tự động (ký tự). */
    private int maxPhraseLength = 600;

    /** Thời gian sống của cache (ngày). */
    private int cacheDays = 60;

    /** Số request tối đa mà một IP được gọi trong một phút. */
    private int rateLimitPerMinute = 60;

    /** Cron expression cho job dọn dẹp cache cũ (mặc định 4:30 AM mỗi ngày). */
    private String cacheCleanupCron = "0 30 4 * * ?";

    /**
     * Ngôn ngữ đích đang được phép dịch, phân tách bằng dấu phẩy.
     *
     * <p>Rỗng nghĩa là dùng danh sách mặc định trong {@link I18nLanguages}.
     */
    private String supportedTargets = "";

    /**
     * Ngôn ngữ đích được phép dịch.
     *
     * <p>Đọc từ {@link #supportedTargets}; nếu không cấu hình thì dùng danh sách mặc định
     * ({@code en}, {@code vi}).
     */
    public java.util.Set<String> resolveSupportedTargets() {
        if (supportedTargets == null || supportedTargets.isBlank()) {
            return I18nLanguages.supportedTargets();
        }
        java.util.Set<String> configured = new java.util.LinkedHashSet<>();
        for (String raw : supportedTargets.split(",")) {
            String code = raw.trim().toLowerCase(java.util.Locale.ROOT);
            if (!code.isEmpty() && I18nLanguages.isKnownTarget(code)) {
                configured.add(code);
            }
        }
        return configured.isEmpty() ? I18nLanguages.supportedTargets() : java.util.Set.copyOf(configured);
    }
}
