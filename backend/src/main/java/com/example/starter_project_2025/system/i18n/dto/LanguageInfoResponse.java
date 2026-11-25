package com.example.starter_project_2025.system.i18n.dto;

import java.util.Map;
import java.util.Set;

/**
 * Mô tả một ngôn ngữ được hỗ trợ.
 *
 * @param code       mã ngôn ngữ (en, vi, ja)
 * @param label      tên hiển thị theo ngôn ngữ gốc
 * @param shortLabel nhãn ngắn dùng cho badge
 * @param enabled    ngôn ngữ đang được phép dịch qua API
 */
public record LanguageInfoResponse(String code, String label, String shortLabel, boolean enabled) {

    public static LanguageInfoResponse from(Map<String, Object> raw, Set<String> enabledTargets) {
        String code = String.valueOf(raw.get("code"));
        boolean enabled = Boolean.TRUE.equals(raw.get("enabled")) && enabledTargets.contains(code);
        return new LanguageInfoResponse(
                code,
                String.valueOf(raw.get("label")),
                String.valueOf(raw.get("shortLabel")),
                enabled
        );
    }
}
