package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nLanguages;

/**
 * Nhận diện ngôn ngữ nguồn của một chuỗi.
 *
 * <p>Dùng để gọi provider không hỗ trợ {@code auto} (MyMemory) mà không giả định nguồn là
 * English. Việc nhận diện dựa trên ký tự đặc trưng nên đủ tin cậy cho nhãn UI.
 */
public final class LanguageDetector {

    private static final java.util.regex.Pattern VIETNAMESE =
            java.util.regex.Pattern.compile("[ĂăÂâĐđÊêÔôƠơƯư]|[\\u0300-\\u036f]|[\\u1ea0-\\u1ef9]");

    private static final java.util.regex.Pattern JAPANESE =
            java.util.regex.Pattern.compile("[\\u3040-\\u30ff\\u4e00-\\u9fff]");

    private LanguageDetector() {
    }

    /**
     * @return mã ngôn ngữ nguồn, hoặc {@code null} khi không xác định được
     */
    public static String detect(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        if (JAPANESE.matcher(text).find()) {
            return I18nLanguages.JA;
        }
        if (VIETNAMESE.matcher(text).find()) {
            return I18nLanguages.VI;
        }
        return I18nLanguages.EN;
    }
}
