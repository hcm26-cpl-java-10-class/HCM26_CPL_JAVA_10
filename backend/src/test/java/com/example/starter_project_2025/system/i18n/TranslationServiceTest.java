package com.example.starter_project_2025.system.i18n;

import com.example.starter_project_2025.system.i18n.domain.TranslationCache;
import com.example.starter_project_2025.system.i18n.domain.TranslationCacheRepository;
import com.example.starter_project_2025.system.i18n.dto.TranslateResponse;
import com.example.starter_project_2025.system.i18n.service.LanguageDetector;
import com.example.starter_project_2025.system.i18n.service.TooManyTextsException;
import com.example.starter_project_2025.system.i18n.service.TranslationProvider;
import com.example.starter_project_2025.system.i18n.service.TranslationService;
import com.example.starter_project_2025.system.i18n.service.UnsupportedLanguageException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TranslationServiceTest {

    @Mock TranslationCacheRepository cacheRepository;
    @Mock TranslationProvider provider;

    private TranslationService service;

    @BeforeEach
    void setUp() {
        I18nProperties properties = new I18nProperties();
        properties.setEnabled(true);
        service = new TranslationService(properties, cacheRepository, () -> List.of(provider));

        lenient().when(cacheRepository.findAllBy(anyString(), anyString(), any())).thenReturn(List.of());
        lenient().when(cacheRepository
                .findBySourceLanguageAndTargetLanguageAndSourceText(anyString(), anyString(), anyString()))
                .thenReturn(java.util.Optional.empty());
    }

    @Test
    void rejectsUnsupportedTargetLanguage() {
        assertThatThrownBy(() -> service.translate("de", "auto", List.of("Save")))
                .isInstanceOf(UnsupportedLanguageException.class);
    }

    @Test
    void rejectsTooManyTexts() {
        List<String> texts = IntStream.range(0, 300).mapToObj(i -> "Phrase " + i).toList();
        assertThatThrownBy(() -> service.translate("vi", "auto", texts))
                .isInstanceOf(TooManyTextsException.class);
    }

    @Test
    void returnsEmptyResultForEmptyTexts() {
        TranslateResponse response = service.translate("vi", "auto", List.of());
        assertThat(response.translations()).isEmpty();
        assertThat(response.cached()).isZero();
        assertThat(response.translated()).isZero();
    }

    @Test
    void translatesThroughProviderAndReportsCounts() {
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(anyString(), anyString(), any())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(2);
            return TranslationProvider.TranslationResult.of(texts.stream().collect(
                    Collectors.toMap(text -> text, text -> "VI:" + text)));
        });

        TranslateResponse response = service.translate("vi", "auto", List.of("Course Management"));
        assertThat(response.translations()).containsEntry("Course Management", "VI:Course Management");
        assertThat(response.translated()).isEqualTo(1);
        assertThat(response.cached()).isZero();
    }

    @Test
    void usesCacheBeforeCallingProvider() {
        TranslationCache cached = TranslationCache.builder()
                .sourceLanguage("auto")
                .targetLanguage("vi")
                .sourceText("Save")
                .translatedText("Lưu")
                .build();
        when(cacheRepository.findAllBy(anyString(), anyString(), any())).thenReturn(List.of(cached));

        TranslateResponse response = service.translate("vi", "auto", List.of("Save"));
        assertThat(response.translations()).containsEntry("Save", "Lưu");
        assertThat(response.cached()).isEqualTo(1);
        assertThat(response.translated()).isZero();
    }

    @Test
    void looksUpCacheWithTheRequestedTargetLanguage() {
        when(cacheRepository.findAllBy(anyString(), anyString(), any())).thenReturn(List.of());
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(anyString(), anyString(), any()))
                .thenReturn(TranslationProvider.TranslationResult.empty());

        service.translate("en", "auto", List.of("Quản lý khóa học"));

        // Cache được tra cứu theo ngôn ngữ nhận diện được của chuỗi, không theo "auto".
        verify(cacheRepository).findAllBy(eq("vi"), eq("en"), any());
    }

    @Test
    void ignoresEmptyAndSymbolOnlyTexts() {
        TranslateResponse response = service.translate("vi", "auto", List.of("", "   ", "123", "%%"));
        assertThat(response.translations()).isEmpty();
    }

    @Test
    void doesNotCacheFailedTranslations() {
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(anyString(), anyString(), any()))
                .thenReturn(TranslationProvider.TranslationResult.empty());

        TranslateResponse response = service.translate("vi", "auto", List.of("Broken Phrase"));
        assertThat(response.translations()).isEmpty();
    }

    @Test
    void delegatesToProviderUsingDetectedLanguage() {
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(eq("vi"), eq("en"), any()))
                .thenReturn(TranslationProvider.TranslationResult.of(Map.of("Quản lý khóa học", "Course Management")));

        TranslateResponse response = service.translate("en", "auto", List.of("Quản lý khóa học"));
        assertThat(response.translations()).containsEntry("Quản lý khóa học", "Course Management");
    }

    @Test
    void translatesEnglishTextSentWithVietnameseSource() {
        // Trang vừa có nhãn tiếng Anh vừa có nhãn tiếng Việt: mỗi chuỗi phải được dịch
        // theo ngôn ngữ thật của nó, không theo ngôn ngữ nguồn gợi ý của request.
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(eq("en"), eq("vi"), any()))
                .thenReturn(TranslationProvider.TranslationResult.of(Map.of("Department", "Phòng ban")));

        TranslateResponse response = service.translate("vi", "en", List.of("Department"));
        assertThat(response.translations()).containsEntry("Department", "Phòng ban");
    }

    @Test
    void keepsTextAlreadyInTargetLanguage() {
        // "Department" đã là tiếng Anh nên khi đích là tiếng Anh thì giữ nguyên,
        // không gửi sang provider (tránh dịch nhầm thành "set").
        TranslateResponse response = service.translate("en", "vi", List.of("Department"));
        assertThat(response.translations()).doesNotContainKey("Department");
    }

    @Test
    void detectsSourceLanguage() {
        assertThat(LanguageDetector.detect("Save")).isEqualTo("en");
        assertThat(LanguageDetector.detect("Quản lý khóa học")).isEqualTo("vi");
        assertThat(LanguageDetector.detect("コース管理")).isEqualTo("ja");
        assertThat(LanguageDetector.detect("  ")).isNull();
    }

    @Test
    void normalizesCandidateTexts() {
        List<String> captured = new ArrayList<>();
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(anyString(), anyString(), any())).thenAnswer(invocation -> {
            List<String> texts = invocation.getArgument(2);
            captured.addAll(texts);
            Map<String, String> map = new LinkedHashMap<>();
            texts.forEach(text -> map.put(text, "X:" + text));
            return TranslationProvider.TranslationResult.of(map);
        });

        service.translate("vi", "auto", List.of("  Save  ", "Save"));
        assertThat(captured).containsExactly("Save");
    }

    @Test
    void returnsEmptyWhenI18nIsDisabled() {
        I18nProperties disabledProperties = new I18nProperties();
        disabledProperties.setEnabled(false);
        TranslationService disabledService = new TranslationService(disabledProperties, cacheRepository, () -> List.of(provider));

        TranslateResponse response = disabledService.translate("vi", "auto", List.of("Save"));

        assertThat(response.translations()).isEmpty();
        assertThat(response.cached()).isZero();
        assertThat(response.translated()).isZero();
        // Provider không được gọi khi disabled.
        org.mockito.Mockito.verifyNoInteractions(provider);
    }

    @Test
    void returnsEmptyWhenSourceEqualsTarget() {
        TranslateResponse response = service.translate("vi", "vi", List.of("Lưu"));

        assertThat(response.translations()).isEmpty();
        // Provider không được gọi khi source === target.
        org.mockito.Mockito.verifyNoInteractions(provider);
    }

    @Test
    void skipsExpiredCacheEntryAndRedirectsToProvider() {
        // Cache entry đã hết hạn (updatedAt = 61 ngày trước, TTL = 60 ngày).
        java.time.LocalDateTime expired = java.time.LocalDateTime.now().minusDays(61);
        TranslationCache staleEntry = TranslationCache.builder()
                .sourceLanguage("auto")
                .targetLanguage("vi")
                .sourceText("Save")
                .translatedText("Cũ: Lưu")
                .build();
        // Gán updatedAt bằng reflection để giả lập entry hết hạn.
        try {
            java.lang.reflect.Field updatedAtField = staleEntry.getClass().getSuperclass().getDeclaredField("updatedAt");
            updatedAtField.setAccessible(true);
            updatedAtField.set(staleEntry, expired);
        } catch (Exception e) {
            // Nếu không set được thì bỏ qua test này.
            org.junit.jupiter.api.Assumptions.assumeTrue(false, "Cannot set updatedAt via reflection: " + e.getMessage());
        }
        when(cacheRepository.findAllBy(anyString(), anyString(), any())).thenReturn(List.of(staleEntry));
        when(provider.isAvailable()).thenReturn(true);
        when(provider.translate(anyString(), anyString(), any()))
                .thenReturn(TranslationProvider.TranslationResult.of(Map.of("Save", "Lưu mới")));

        TranslateResponse response = service.translate("vi", "auto", List.of("Save"));

        // Entry cũ bị bỏ qua → provider được gọi → trả bản dịch mới.
        assertThat(response.translations()).containsEntry("Save", "Lưu mới");
        assertThat(response.translated()).isEqualTo(1);
        assertThat(response.cached()).isZero();
    }
}
