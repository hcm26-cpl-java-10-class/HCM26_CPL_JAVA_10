package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nProperties;
import com.example.starter_project_2025.system.i18n.domain.TranslationCacheRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * Xoá các bản dịch đã hết hạn (TTL theo {@code app.i18n.cache-days}).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class TranslationCacheCleanupJob {

    private final I18nProperties properties;
    private final TranslationCacheRepository cacheRepository;

    @Scheduled(cron = "${app.i18n.cache-cleanup-cron:0 30 4 * * ?}")
    public void purgeExpired() {
        if (!properties.isEnabled()) {
            return;
        }
        LocalDateTime threshold = LocalDateTime.now().minusDays(properties.getCacheDays());
        int removed = cacheRepository.deleteOlderThan(threshold);
        if (removed > 0) {
            log.info("[i18n] Purged {} expired translation cache entries", removed);
        }
    }
}
