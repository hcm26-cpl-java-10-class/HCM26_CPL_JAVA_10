package com.example.starter_project_2025.system.i18n.service;

import com.example.starter_project_2025.system.i18n.I18nLanguages;
import com.example.starter_project_2025.system.i18n.I18nProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Provider dự phòng: dịch từng chuỗi qua MyMemory.
 *
 * <p>MyMemory chậm hơn nhưng có quota riêng, nên dùng khi Google Translate bị rate limit.
 * API chỉ nhận một chuỗi mỗi request và không tự nhận diện ngôn ngữ nguồn, nên provider này
 * chỉ được dùng khi đã xác định được ngôn ngữ nguồn cụ thể.
 */
@Service
@Slf4j
public class MyMemoryProvider implements TranslationProvider {

    private static final java.util.Set<String> ERROR_MARKERS = java.util.Set.of(
            "MYMEMORY WARNING",
            "QUERY LENGTH LIMIT",
            "INVALID LANGUAGE PAIR"
    );

    /** Tạm dừng lâu khi bị chặn do vượt quota (429) hoặc bị từ chối (403). */
    private static final Duration QUOTA_COOLDOWN = Duration.ofMinutes(10);

    /** Tạm dừng ngắn khi gặp lỗi mạng hoặc lỗi server. */
    private static final Duration ERROR_COOLDOWN = Duration.ofMinutes(1);

    private final I18nProperties properties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;
    private final ProviderCooldown cooldown = new ProviderCooldown("MyMemory");

    public MyMemoryProvider(
            I18nProperties properties,
            ObjectMapper objectMapper,
            @Qualifier("translationRestTemplate") RestTemplate restTemplate
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.restTemplate = restTemplate;
    }

    @Override
    public String name() {
        return "mymemory";
    }

    @Override
    public boolean isAvailable() {
        return properties.isEnabled() && !cooldown.isOpen();
    }

    @Override
    public TranslationResult translate(String sourceLanguage, String targetLanguage, List<String> texts) {
        if (I18nLanguages.AUTO.equals(sourceLanguage)) {
            // Không giả định nguồn là English: provider này cần một mã ngôn ngữ cụ thể.
            return TranslationResult.empty();
        }

        Map<String, String> result = new LinkedHashMap<>();
        Map<String, String> detected = new LinkedHashMap<>();
        for (String text : texts) {
            String translated = translateOne(sourceLanguage, targetLanguage, text);
            if (translated != null && !translated.isBlank()) {
                result.put(text, translated);
                detected.put(text, sourceLanguage);
            }
        }
        return new TranslationResult(result, detected);
    }

    private String translateOne(String sourceLanguage, String targetLanguage, String text) {
        // Dùng template + `uriVariables` để giá trị được encode đúng một lần bởi
        // `DefaultUriBuilderFactory` (chế độ VALUES_ONLY).
        Map<String, String> uriVariables = new LinkedHashMap<>();
        uriVariables.put("q", text);
        uriVariables.put("langpair", sourceLanguage + "|" + targetLanguage);
        String uriTemplate = buildUriTemplate(properties.getMyMemoryEndpoint(), uriVariables);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set(HttpHeaders.USER_AGENT, "Mozilla/5.0");

        try {
            String body = restTemplate.exchange(
                            uriTemplate,
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            String.class,
                            uriVariables
                    )
                    .getBody();
            if (body == null || body.isBlank()) {
                return null;
            }
            JsonNode root = objectMapper.readTree(body);
            // MyMemory trả về HTTP 200 kèm thông báo lỗi trong body.
            int status = root.path("responseStatus").asInt(200);
            if (status >= 400) {
                return null;
            }
            String translated = root.path("responseData").path("translatedText").asText("");
            if (translated.isBlank() || containsErrorMarker(translated)) {
                return null;
            }
            return translated;
        } catch (HttpStatusCodeException ex) {
            int status = ex.getStatusCode().value();
            if (status == 429 || status == 403) {
                cooldown.trip(QUOTA_COOLDOWN, "HTTP " + status, log);
            } else {
                cooldown.trip(ERROR_COOLDOWN, "HTTP " + status, log);
            }
            return null;
        } catch (Exception ex) {
            cooldown.trip(ERROR_COOLDOWN, ex.getClass().getSimpleName(), log);
            return null;
        }
    }

    private static boolean containsErrorMarker(String translated) {
        for (String marker : ERROR_MARKERS) {
            if (translated.contains(marker)) {
                return true;
            }
        }
        return false;
    }
}
