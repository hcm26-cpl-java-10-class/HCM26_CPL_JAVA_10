package com.example.starter_project_2025.system.i18n.dto;

import java.util.Map;

/**
 * Kết quả dịch.
 *
 * @param translations map từ chuỗi nguồn sang chuỗi đã dịch (chuỗi không dịch được sẽ không có trong map)
 * @param cached       số chuỗi được lấy từ cache
 * @param translated   số chuỗi được dịch mới
 */
public record TranslateResponse(Map<String, String> translations, int cached, int translated) {
}
