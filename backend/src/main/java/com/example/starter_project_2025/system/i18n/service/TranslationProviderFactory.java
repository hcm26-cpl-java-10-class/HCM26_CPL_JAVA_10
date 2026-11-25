package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Chọn và sắp xếp các provider dịch theo cấu hình.
 *
 * <p>Mục đích là có một chỗ duy nhất quyết định provider nào được dùng và theo thứ tự nào,
 * để khi cần đổi sang engine khác (ví dụ LibreTranslate tự host) chỉ phải đăng ký thêm
 * provider và cấu hình {@code app.i18n.provider} chứ không phải sửa logic service.
 *
 * <p>Giá trị cấu hình:
 * <ul>
 *   <li>{@code google} — chỉ Google Translate.</li>
 *   <li>{@code mymemory} — chỉ MyMemory.</li>
 *   <li>{@code google+mymemory} — Google Translate trước, MyMemory làm dự phòng (mặc định).</li>
 * </ul>
 */
@Service
@Slf4j
public class TranslationProviderFactory implements TranslationProviderResolver {

    /** Tên provider dùng để đối chiếu với cấu hình. */
    private static final String GOOGLE = "google";
    private static final String MYMEMORY = "mymemory";

    private final I18nProperties properties;
    private final GoogleTranslateProvider googleProvider;
    private final MyMemoryProvider myMemoryProvider;

    public TranslationProviderFactory(
            I18nProperties properties,
            GoogleTranslateProvider googleProvider,
            MyMemoryProvider myMemoryProvider
    ) {
        this.properties = properties;
        this.googleProvider = googleProvider;
        this.myMemoryProvider = myMemoryProvider;
    }

    /**
     * Trả về danh sách provider theo thứ tự ưu tiên đã cấu hình.
     *
     * <p>Luôn có provider dự phòng sau provider chính để một provider bị chặn (429) thì
     * request vẫn được xử lý bởi provider còn lại.
     */
    @Override
    public List<TranslationProvider> resolveProviders() {
        String configured = properties.getProvider();
        if (configured == null || configured.isBlank()) {
            configured = GOOGLE + "+" + MYMEMORY;
        }
        String normalized = configured.trim().toLowerCase(Locale.ROOT);

        Map<String, TranslationProvider> byName = new LinkedHashMap<>();
        byName.put(GOOGLE, googleProvider);
        byName.put(MYMEMORY, myMemoryProvider);

        List<TranslationProvider> selected = new ArrayList<>();
        for (String token : normalized.split("[+,]")) {
            String key = token.trim();
            if (key.isEmpty()) {
                continue;
            }
            TranslationProvider provider = byName.get(key);
            if (provider == null) {
                log.warn("[i18n] Unknown provider '{}' in app.i18n.provider, ignored", key);
                continue;
            }
            if (!selected.contains(provider)) {
                selected.add(provider);
            }
        }

        if (selected.isEmpty()) {
            log.warn("[i18n] app.i18n.provider='{}' did not match any provider, fallback to google+mymemory",
                    normalized);
            selected.add(googleProvider);
            selected.add(myMemoryProvider);
        }
        return selected;
    }
}
