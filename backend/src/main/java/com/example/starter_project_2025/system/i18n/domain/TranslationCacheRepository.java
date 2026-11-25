package com.example.starter_project_2025.system.i18n.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TranslationCacheRepository extends JpaRepository<TranslationCache, Long> {

    Optional<TranslationCache> findBySourceLanguageAndTargetLanguageAndSourceText(
            String sourceLanguage,
            String targetLanguage,
            String sourceText
    );

    @Query("""
            select c from TranslationCache c
            where c.sourceLanguage = :sourceLanguage
              and c.targetLanguage = :targetLanguage
              and c.sourceText in :sourceTexts
            """)
    List<TranslationCache> findAllBy(
            @Param("sourceLanguage") String sourceLanguage,
            @Param("targetLanguage") String targetLanguage,
            @Param("sourceTexts") Collection<String> sourceTexts
    );

    @Modifying
    @Query("delete from TranslationCache c where c.updatedAt < :threshold")
    int deleteOlderThan(@Param("threshold") LocalDateTime threshold);
}
