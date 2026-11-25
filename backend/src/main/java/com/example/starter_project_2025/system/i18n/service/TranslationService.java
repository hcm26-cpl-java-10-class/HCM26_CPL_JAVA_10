package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nProperties;
import com.example.starter_project_2025.system.i18n.domain.TranslationCache;
import com.example.starter_project_2025.system.i18n.domain.TranslationCacheRepository;
import com.example.starter_project_2025.system.i18n.dto.TranslateResponse;
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
@Slf4j
public class TranslationService {

    /**
     * Đoạn đánh dấu phiên bản mà dịch vụ dịch tự động chèn vào bản dịch.
     *
     * <p>Ví dụ MyMemory trả về {@code "Thiết kế cơ sở dữ liệu<x id="1"/> "}.
     */
    private static final java.util.regex.Pattern MARKUP_ARTIFACT =
            java.util.regex.Pattern.compile("<\\s*x\\s+id\\s*=\\s*\"[^\"]*\"\\s*/\\s*>");

    /** Thẻ HTML còn sót lại trong bản dịch. */
    private static final java.util.regex.Pattern HTML_TAG =
            java.util.regex.Pattern.compile("</?[a-zA-Z][^>]*>");

    private final I18nProperties properties;
    private final TranslationCacheRepository cacheRepository;
    private final TranslationProviderResolver providerResolver;

    /**
     * Tầng dịch tự động.
     *
     * @param properties       cấu hình tầng i18n
     * @param cacheRepository  kho cache trong database
     * @param providerResolver chọn provider theo cấu hình {@code app.i18n.provider}
     */
    public TranslationService(
            I18nProperties properties,
            TranslationCacheRepository cacheRepository,
            TranslationProviderResolver providerResolver
    ) {
        this.properties = properties;
        this.cacheRepository = cacheRepository;
        this.providerResolver = providerResolver;
    }

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

        // Mỗi chuỗi có thể thuộc ngôn ngữ nguồn khác nhau (trang vừa có nhãn tiếng Anh vừa
        // có nhãn tiếng Việt), nên cache được tra cứu theo ngôn ngữ thật của từng chuỗi.
        Map<String, List<String>> bySource = groupByDetectedSource(new ArrayList<>(candidates), targetLanguage);

        Map<String, String> result = new LinkedHashMap<>();
        List<String> missing = new ArrayList<>();

        // 1. Cache
        LocalDateTime expiry = LocalDateTime.now().minusDays(properties.getCacheDays());
        for (Map.Entry<String, List<String>> entry : bySource.entrySet()) {
            List<TranslationCache> cached = cacheRepository.findAllBy(
                    entry.getKey(), targetLanguage, entry.getValue()
            );
            for (TranslationCache cachedEntry : cached) {
                if (cachedEntry.getUpdatedAt() != null && cachedEntry.getUpdatedAt().isBefore(expiry)) {
                    continue;
                }
                result.put(cachedEntry.getSourceText(), sanitizeTranslated(cachedEntry.getTranslatedText()));
                missing.remove(cachedEntry.getSourceText());
            }
        }
        int cachedCount = result.size();

        // 2. Provider chính rồi provider dự phòng
        if (!bySource.isEmpty()) {
            Map<String, String> fetched = fetchFromProviders(targetLanguage, bySource);
            result.putAll(fetched);
            for (Map.Entry<String, List<String>> entry : bySource.entrySet()) {
                for (String text : entry.getValue()) {
                    if (!result.containsKey(text)) {
                        missing.add(text);
                    }
                }
            }
        }

        int translatedCount = result.size() - cachedCount;

        // 3. Ghi cache cho những chuỗi mới dịch được
        if (translatedCount > 0) {
            persist(targetLanguage, bySource, result);
        }

        return new TranslateResponse(result, cachedCount, translatedCount);
    }

    private Map<String, String> fetchFromProviders(
            String targetLanguage,
            Map<String, List<String>> bySource
    ) {
        Map<String, String> collected = new LinkedHashMap<>();
        List<String> remaining = new ArrayList<>();
        bySource.values().forEach(remaining::addAll);

        for (TranslationProvider provider : providerResolver.resolveProviders()) {
            if (remaining.isEmpty()) {
                break;
            }
            if (!provider.isAvailable()) {
                continue;
            }
            TranslationProvider.TranslationResult translated;
            try {
                // Ngôn ngữ nguồn được frontend gửi lên chỉ là gợi ý: một batch thường lẫn lộn
                // nhãn tiếng Anh và tiếng Việt. Mỗi chuỗi được dịch theo ngôn ngữ thật của nó
                // để không dịch nhầm chiều (ví dụ "Department" gửi kèm source=vi sẽ ra "set").
                Map<String, String> providerMap = new LinkedHashMap<>();
                for (Map.Entry<String, List<String>> entry : bySource.entrySet()) {
                    TranslationProvider.TranslationResult subResult =
                            provider.translate(entry.getKey(), targetLanguage, entry.getValue());
                    if (subResult != null && subResult.translations() != null) {
                        providerMap.putAll(subResult.translations());
                    }
                }
                translated = TranslationProvider.TranslationResult.of(providerMap);
            } catch (Exception ex) {
                // Provider đã tự xử lý cooldown và chỉ log 1 dòng WARN; ở đây chỉ ghi debug
                // để không spam log mỗi lần có provider lỗi.
                log.debug("[i18n] Provider {} failed: {}", provider.name(), ex.getMessage());
                continue;
            }
            if (translated == null || translated.translations() == null || translated.translations().isEmpty()) {
                continue;
            }
            translated.translations().forEach((key, value) -> {
                if (value != null && !value.isBlank()) {
                    collected.put(key, sanitizeTranslated(value));
                }
            });
            remaining.removeIf(collected::containsKey);
        }

        if (!remaining.isEmpty()) {
            log.debug("[i18n] {} phrase(s) could not be translated", remaining.size());
        }
        return collected;
    }

    /**
     * Gom các chuỗi theo ngôn ngữ nguồn thật của từng chuỗi.
     *
     * <p>Chuỗi đã đúng ngôn ngữ đích thì bỏ qua (giữ nguyên bản gốc). Các chuỗi còn lại
     * được nhóm theo ngôn ngữ nhận diện được để provider dịch đúng chiều.
     */
    private Map<String, List<String>> groupByDetectedSource(
            List<String> texts,
            String targetLanguage
    ) {
        Map<String, List<String>> bySource = new LinkedHashMap<>();
        for (String text : texts) {
            String detected = LanguageDetector.detect(text);
            if (detected == null || detected.equals(targetLanguage)) {
                // Đã là ngôn ngữ đích: giữ nguyên, không cần dịch.
                continue;
            }
            bySource.computeIfAbsent(detected, k -> new ArrayList<>()).add(text);
        }
        return bySource;
    }

    private void persist(
            String targetLanguage,
            Map<String, List<String>> bySource,
            Map<String, String> translations
    ) {
        for (Map.Entry<String, List<String>> entry : bySource.entrySet()) {
            String sourceLanguage = entry.getKey();
            for (String sourceText : entry.getValue()) {
                String translated = translations.get(sourceText);
                if (translated == null || translated.isBlank()) {
                    continue;
                }
                try {
                    TranslationCache cacheEntry = cacheRepository
                            .findBySourceLanguageAndTargetLanguageAndSourceText(
                                    sourceLanguage, targetLanguage, sourceText)
                            .orElseGet(() -> TranslationCache.builder()
                                    .sourceLanguage(sourceLanguage)
                                    .targetLanguage(targetLanguage)
                                    .sourceText(sourceText)
                                    .build());
                    cacheEntry.setTranslatedText(truncate(translated, 1000));
                    cacheEntry.setDetectedLanguage(sourceLanguage);
                    cacheRepository.save(cacheEntry);
                } catch (DataIntegrityViolationException ex) {
                    // Unique constraint bị chạm khi hai request cùng dịch một cụm từ và cùng insert.
                    // Đọc lại bản ghi đã có rồi cập nhật bản dịch, không nuốt lỗi.
                    updateExisting(targetLanguage, sourceLanguage, sourceText, translated, sourceLanguage);
                } catch (Exception ex) {
                    log.debug("[i18n] Cannot cache '{}': {}", sourceText, ex.getMessage());
                }
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
            log.debug("[i18n] Cannot update cache for '{}': {}", sourceText, ex.getMessage());
        }
    }

    /**
     * Loại bỏ rác do dịch vụ dịch tự động chèn vào kết quả.
     *
     * <p>MyMemory hay gắn thêm đoạn đánh dấu phiên bản vào bản dịch
     * (ví dụ {@code "Thiết kế cơ sở dữ liệu<x id="1"/>"}). Đoạn này là metadata của dịch vụ,
     * không thuộc về nội dung nên phải bị loại bỏ trước khi hiển thị.
     */
    private static String sanitizeTranslated(String value) {
        String cleaned = MARKUP_ARTIFACT.matcher(value).replaceAll("").trim();
        // Dịch vụ đôi khi bọc kết quả trong thẻ HTML.
        cleaned = HTML_TAG.matcher(cleaned).replaceAll("").trim();
        return cleaned.isEmpty() ? value.trim() : cleaned;
    }

    /** Loại bỏ chuỗi tối giản, chỉ số / ký hiệu / chữ cái. */
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
