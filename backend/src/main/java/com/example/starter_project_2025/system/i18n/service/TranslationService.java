package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nLanguages;
import com.example.starter_project_2025.system.i18n.I18nProperties;
import com.example.starter_project_2025.system.i18n.domain.TranslationCache;
import com.example.starter_project_2025.system.i18n.domain.TranslationCacheRepository;
import com.example.starter_project_2025.system.i18n.dto.TranslateResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tầng dịch tự động.
 *
 * <p>Luồng xử lý: cache trong database -> provider chính (Google Translate) -> provider dự phòng
 * (MyMemory) -> ghi kết quả mới vào cache. Nhờ vậy, mỗi cụm từ chỉ được dịch tối đa một
 * lần cho mỗi cặp ngôn ngữ, và các lần render sau dùng cache (không gọi ra ngoài).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationService {

    private final I18nProperties properties;
    private final TranslationCacheRepository cacheRepository;
    private final List<TranslationProvider> providers;
    public TranslateResponse translate(String targetLanguage, String sourceLanguage, List<String> texts) {
        if (texts == null || texts.isEmpty()) {
            return new TranslateResponse(Map.of(), 0, 0);
        }
        if (!properties.isEnabled()) {
            return new TranslateResponse(Map.of(), 0, 0);
        }
        if (!properties.resolveSupportedTargets().contains(targetLanguage)) {
            throw new UnsupportedLanguageException(targetLanguage);
        }
        if (sourceLanguage != null && sourceLanguage.equals(targetLanguage)) {
            // Dịch sang chính ngôn ngữ nguồn là vô nghĩa.
            return new TranslateResponse(Map.of(), 0, 0);
        }
        if (texts.size() > properties.getMaxTextsPerRequest()) {
            throw new TooManyTextsException(properties.getMaxTextsPerRequest());
        }

        Set<String> candidates = normalizeCandidates(texts);
        if (candidates.isEmpty()) {
            return new TranslateResponse(Map.of(), 0, 0);
        }

        String requestedSource = resolveSourceLanguage(sourceLanguage);

        Map<String, String> result = new LinkedHashMap<>();
        List<String> missing = new ArrayList<>(candidates);

        // 1. Cache
        List<TranslationCache> cached = cacheRepository.findAllBy(
                requestedSource, targetLanguage, candidates
        );
        LocalDateTime expiry = LocalDateTime.now().minusDays(properties.getCacheDays());
        for (TranslationCache entry : cached) {
            if (entry.getUpdatedAt() != null && entry.getUpdatedAt().isBefore(expiry)) {
                continue;
            }
            result.put(entry.getSourceText(), entry.getTranslatedText());
            missing.remove(entry.getSourceText());
        }
        int cachedCount = result.size();

        // 2. Provider chính rồi provider dự phòng
        if (!missing.isEmpty()) {
            Map<String, String> fetched = fetchFromProviders(requestedSource, targetLanguage, missing);
            result.putAll(fetched);
        }

        int translatedCount = result.size() - cachedCount;

        // 3. Ghi cache cho những chuỗi mới dịch được
        if (translatedCount > 0) {
            persist(targetLanguage, requestedSource, result, missing);
        }

        return new TranslateResponse(result, cachedCount, translatedCount);
    }

    /**
     * Ngôn ngữ nguồn dùng cho request.
     *
     * <p>Mặc định là {@code auto} để dịch vụ tự nhận diện: ứng dụng có cả nhãn viết sẵn bằng
     * tiếng Việt lẫn nhãn tiếng Anh, nên không thể suy ra chiều dịch một cách chắc chắn ở
     * phía frontend.
     */
    private static String resolveSourceLanguage(String requested) {
        if (requested == null || requested.isBlank()) {
            return I18nLanguages.AUTO;
        }
        if (I18nLanguages.AUTO.equals(requested) || I18nLanguages.isKnownTarget(requested)) {
            return requested;
        }
        return I18nLanguages.AUTO;
    }

    private Map<String, String> fetchFromProviders(
            String sourceLanguage,
            String targetLanguage,
            List<String> texts
    ) {
        Map<String, String> collected = new LinkedHashMap<>();
        List<String> remaining = new ArrayList<>(texts);

        for (TranslationProvider provider : providers) {
            if (remaining.isEmpty()) {
                break;
            }
            if (!provider.isAvailable()) {
                continue;
            }
            TranslationProvider.TranslationResult translated;
            try {
                if (I18nLanguages.AUTO.equals(sourceLanguage) && !provider.supportsAutoDetection()) {
                    Map<String, String> providerMap = new LinkedHashMap<>();
                    Map<String, List<String>> bySource = new LinkedHashMap<>();
                    for (String text : remaining) {
                        String detected = LanguageDetector.detect(text);
                        if (detected != null && !detected.equals(targetLanguage)) {
                            bySource.computeIfAbsent(detected, k -> new ArrayList<>()).add(text);
                        }
                    }
                    for (Map.Entry<String, List<String>> entry : bySource.entrySet()) {
                        TranslationProvider.TranslationResult subResult =
                                provider.translate(entry.getKey(), targetLanguage, entry.getValue());
                        if (subResult != null && subResult.translations() != null) {
                            providerMap.putAll(subResult.translations());
                        }
                    }
                    translated = TranslationProvider.TranslationResult.of(providerMap);
                } else {
                    translated = provider.translate(sourceLanguage, targetLanguage, remaining);
                }
            } catch (Exception ex) {
                log.warn("[i18n] Provider {} failed: {}", provider.name(), ex.getMessage());
                continue;
            }
            if (translated == null || translated.translations() == null || translated.translations().isEmpty()) {
                continue;
            }
            translated.translations().forEach((key, value) -> {
                if (value != null && !value.isBlank()) {
                    collected.put(key, value);
                }
            });
            remaining.removeIf(collected::containsKey);
        }

        if (!remaining.isEmpty()) {
            log.debug("[i18n] {} phrase(s) could not be translated", remaining.size());
        }
        return collected;
    }

    private void persist(
            String targetLanguage,
            String sourceLanguage,
            Map<String, String> translations,
            List<String> candidates
    ) {
        for (String sourceText : candidates) {
            String translated = translations.get(sourceText);
            if (translated == null || translated.isBlank()) {
                continue;
            }
            String detected = LanguageDetector.detect(sourceText);
            try {
                TranslationCache entry = cacheRepository
                        .findBySourceLanguageAndTargetLanguageAndSourceText(
                                sourceLanguage, targetLanguage, sourceText)
                        .orElseGet(() -> TranslationCache.builder()
                                .sourceLanguage(sourceLanguage)
                                .targetLanguage(targetLanguage)
                                .sourceText(sourceText)
                                .build());
                entry.setTranslatedText(truncate(translated, 1000));
                entry.setDetectedLanguage(detected);
                cacheRepository.save(entry);
            } catch (DataIntegrityViolationException ex) {
                // Unique constraint bị chạm khi hai request cùng dịch một cụm từ và cùng insert.
                // Đọc lại bản ghi đã có rồi cập nhật bản dịch, không nuốt lỗi.
                updateExisting(targetLanguage, sourceLanguage, sourceText, translated, detected);
            } catch (Exception ex) {
                log.warn("[i18n] Cannot cache '{}': {}", sourceText, ex.getMessage());
            }
        }
    }

    /** Ghi đè bản dịch vào bản ghi cache đã tồn tại (sau khi gặp unique constraint). */
    private void updateExisting(
            String targetLanguage,
            String sourceLanguage,
            String sourceText,
            String translated,
            String detected
    ) {
        try {
            cacheRepository
                    .findBySourceLanguageAndTargetLanguageAndSourceText(
                            sourceLanguage, targetLanguage, sourceText)
                    .ifPresent(entry -> {
                        entry.setTranslatedText(truncate(translated, 1000));
                        entry.setDetectedLanguage(detected);
                        cacheRepository.save(entry);
                    });
        } catch (Exception ex) {
            log.warn("[i18n] Cannot update cache for '{}': {}", sourceText, ex.getMessage());
        }
    }

    /** Loại bỏ chuỗi rỗng / quá dài / trùng lặp. */
    private Set<String> normalizeCandidates(List<String> texts) {
        Set<String> candidates = new LinkedHashSet<>();
        for (String raw : texts) {
            if (raw == null) {
                continue;
            }
            String trimmed = raw.trim();
            if (trimmed.isEmpty() || trimmed.length() > properties.getMaxPhraseLength()) {
                continue;
            }
            // Chuỗi chỉ chứa ký tự số / ký hiệu thì dịch không có ý nghĩa.
            if (!trimmed.matches(".*[\\p{L}].*")) {
                continue;
            }
            candidates.add(trimmed);
        }
        return candidates;
    }

    private static String truncate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
