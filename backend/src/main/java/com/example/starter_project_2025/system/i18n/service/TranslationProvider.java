package com.example.starter_project_2025.system.i18n.service;

import java.util.List;
import java.util.Map;

/**
 * Nguồn dịch cho tầng dịch tự động.
 *
 * <p>Mỗi provider trả về cặp chuỗi nguồn -> chuỗi đã dịch, kèm ngôn ngữ nguồn được
 * nhận diện (nếu provider biết) để cache ghi lại đúng thông tin.
 */
public interface TranslationProvider {

    /** Tên provider, dùng cho log. */
    String name();

    /** Provider có dùng được không (cấu hình bật, thêm API key nếu có). */
    boolean isAvailable();

    /** Provider có tự nhận diện được ngôn ngữ nguồn khi nhận {@code "auto"} hay không. */
    default boolean supportsAutoDetection() {
        return false;
    }

    /**
     * Dịch danh sách chuỗi.
     *
     * @param sourceLanguage ngôn ngữ nguồn, hoặc {@code "auto"} để provider tự nhận diện
     * @param targetLanguage ngôn ngữ đích
     * @param texts          chuỗi nguồn
     * @return kết quả dịch, không chứa chuỗi lỗi của provider
     */
    TranslationResult translate(String sourceLanguage, String targetLanguage, List<String> texts);

    /**
     * Kết quả dịch của một provider.
     *
     * @param translations      chuỗi nguồn -> chuỗi đã dịch
     * @param detectedLanguages chuỗi nguồn -> ngôn ngữ nguồn được nhận diện
     */
    record TranslationResult(Map<String, String> translations, Map<String, String> detectedLanguages) {

        public static TranslationResult empty() {
            return new TranslationResult(Map.of(), Map.of());
        }

        public static TranslationResult of(Map<String, String> translations) {
            return new TranslationResult(translations, Map.of());
        }
    }
}
