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
     * Dựng URI template từ URL gốc và các tham số query.
     *
     * <p>Mỗi giá trị được gắn vào một placeholder riêng ({@code ?name={name}}) để
     * {@code RestTemplate} encode đúng một lần. Nếu nối chuỗi thủ công thì khoảng trắng, {@code &},
     * {@code [} hay dấu tiếng Việt sẽ làm hỏng URI và dịch vụ trả về kết quả sai.
     *
     * @param baseUrl URL gốc, có thể đã kèm query string
     * @param params  tham số query, mỗi tham số sẽ thành một placeholder
     * @return URI template dùng được với {@code RestTemplate.exchange(..., uriVariables)}
     */
    default String buildUriTemplate(String baseUrl, Map<String, String> params) {
        StringBuilder template = new StringBuilder(baseUrl);
        boolean first = !baseUrl.contains("?");
        for (Map.Entry<String, String> entry : params.entrySet()) {
            template.append(first ? '?' : '&')
                    .append(entry.getKey())
                    .append("={")
                    .append(entry.getKey())
                    .append('}');
            first = false;
        }
        return template.toString();
    }

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
