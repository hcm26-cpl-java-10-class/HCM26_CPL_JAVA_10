package com.example.starter_project_2025.system.i18n.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Request dịch tự động.
 *
 * @param targetLanguage ngôn ngữ đích (en, vi, ja)
 * @param sourceLanguage ngôn ngữ nguồn; để trống hoặc "auto" thì dịch vụ tự nhận diện
 * @param texts          danh sách chuỗi nguồn cần dịch
 */
public record TranslateRequest(
        @NotBlank String targetLanguage,
        String sourceLanguage,
        @NotEmpty @Size(max = 200) List<@Size(max = 600) String> texts
) {
}
