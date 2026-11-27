package com.example.starter_project_2025.system.i18n.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.FieldDefaults;
import lombok.experimental.SuperBuilder;

import static lombok.AccessLevel.PRIVATE;

/**
 * Cache của các cụm từ đã dịch tự động.
 *
 * <p>Khóa duy nhất là {@code (sourceLanguage, targetLanguage, sourceText)}: cùng một chuỗi nguồn
 * luôn cho ra cùng một kết quả dịch, nên cache được dùng lại cho mọi lần render.
 */
@Entity
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = PRIVATE)
@Table(
        name = "i18n_translation_cache",
        indexes = @Index(
                name = "idx_i18n_cache_lookup",
                columnList = "source_language,target_language,source_text"
        ),
        uniqueConstraints = @UniqueConstraint(
                name = "uk_i18n_cache_source_target_text",
                columnNames = {"source_language", "target_language", "source_text"}
        )
)
public class TranslationCache extends BaseEntity {

    @Column(name = "source_language", nullable = false, length = 10)
    String sourceLanguage;

    @Column(name = "target_language", nullable = false, length = 10)
    String targetLanguage;

    @Column(name = "source_text", nullable = false, length = 600)
    String sourceText;

    @Column(name = "translated_text", nullable = false, length = 1000)
    String translatedText;

    /** Ngôn ngữ mà dịch vụ dịch tự động nhận diện được cho chuỗi nguồn (ví dụ "en", "vi"). */
    @Column(name = "detected_language", length = 10)
    String detectedLanguage;
}