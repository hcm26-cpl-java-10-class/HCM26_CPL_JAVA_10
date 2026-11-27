package com.example.starter_project_2025.system.i18n;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Danh sách ngôn ngữ được hỗ trợ, dùng chung cho controller, service và cache.
 *
 * <p>Frontend dùng cùng danh sách này nên ngôn ngữ hiển thị trên UI luôn dịch được.
 *
 * <p>Phân biệt hai danh sách:
 * <ul>
 *   <li>{@link #KNOWN_TARGETS} — các ngôn ngữ đã có provider + cache + fallback; dùng để tra cứu
 *       và để bật lại một ngôn ngữ sau khi hoàn thiện.</li>
 *   <li>{@link #ENABLED_TARGETS} — các ngôn ngữ đang được phép dịch qua API. Ngôn ngữ chưa bật
 *       sẽ bị từ chối bằng lỗi có mã ổn định thay vì trả về map rỗng.</li>
 * </ul>
 */
public final class I18nLanguages {

    public static final String EN = "en";
    public static final String VI = "vi";
    public static final String JA = "ja";

    /** Ngôn ngữ dùng khi không xác định được nguồn của chuỗi. */
    public static final String AUTO = "auto";

    /** Mô tả ngôn ngữ gửi cho frontend để hai tầng không lệch nhau. */
    private record LanguageInfo(String code, String label, String shortLabel, boolean enabled) {
    }

    private static final List<LanguageInfo> LANGUAGES = List.of(
            new LanguageInfo(EN, "English", "EN", true),
            new LanguageInfo(VI, "Tiếng Việt", "VI", true),
            new LanguageInfo(JA, "日本語", "JA", false)
    );

    /** Ngôn ngữ đã được tích hợp đầy đủ (provider, cache, fallback). */
    private static final Set<String> KNOWN_TARGETS = Set.of(EN, VI, JA);

    /** Ngôn ngữ đang được phép dịch qua API. */
    private static final Set<String> ENABLED_TARGETS = Set.of(EN, VI);

    private I18nLanguages() {
    }

    /** True khi ngôn ngữ đang được phép dịch qua API. */
    public static boolean isSupportedTarget(String language) {
        return language != null && ENABLED_TARGETS.contains(language);
    }

    /** True khi ngôn ngữ đã được tích hợp (kể cả khi chưa bật). */
    public static boolean isKnownTarget(String language) {
        return language != null && KNOWN_TARGETS.contains(language);
    }

    public static Set<String> supportedTargets() {
        return ENABLED_TARGETS;
    }

    public static Set<String> knownTargets() {
        return KNOWN_TARGETS;
    }

    /** Danh sách ngôn ngữ kèm nhãn, dùng cho endpoint {@code GET /api/i18n/languages}. */
    public static List<Map<String, Object>> describeAll() {
        return LANGUAGES.stream()
                .map(info -> Map.<String, Object>of(
                        "code", info.code(),
                        "label", info.label(),
                        "shortLabel", info.shortLabel(),
                        "enabled", info.enabled()
                ))
                .toList();
    }
}
