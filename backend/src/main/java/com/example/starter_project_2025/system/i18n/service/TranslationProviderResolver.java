package com.example.starter_project_2025.system.i18n.service;

import java.util.List;

/**
 * Chọn danh sách provider dịch sẽ dùng cho một request.
 *
 * <p>Tách thành interface để service không phụ thuộc trực tiếp vào provider cụ thể:
 * khi cần đổi engine dịch chỉ thay implementation của interface này, không phải sửa
 * logic của {@link TranslationService}.
 */
@FunctionalInterface
public interface TranslationProviderResolver {

    /**
     * @return các provider theo thứ tự ưu tiên; provider đầu tiên là provider chính
     */
    List<TranslationProvider> resolveProviders();
}
