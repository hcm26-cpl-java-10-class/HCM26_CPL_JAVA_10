package com.example.starter_project_2025.system.i18n.service;

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
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Dịch qua endpoint công khai của Google Translate.
 *
 * <p>Endpoint này không cần API key nhưng có rate limit rất chặt, nên tầng trên luôn kiểm tra
 * cache trước và gom nhiều chuỗi thành một request duy nhất. Khi bị chặn (429) thì provider trả
 * về map rỗng, tầng trên sẽ thử provider dự phòng.
 */
@Service
@Slf4j
public class GoogleTranslateProvider implements TranslationProvider {

    /**
     * Dấu phân cách giữa các chuỗi trong một request.
     *
     * <p>Dùng newline: đây là ký tự mà dịch vụ dịch giữ nguyên và trả về từng chuỗi riêng
     * biệt. Các ký tự điều khiển khác (ví dụ {@code 0x1F}) bị dịch vụ nuốt mất.
     */
    private static final String SEPARATOR = "\n";

    private final I18nProperties properties;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public GoogleTranslateProvider(
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
        return "google-translate";
    }

    @Override
    public boolean isAvailable() {
        return properties.isEnabled();
    }

    @Override
    public boolean supportsAutoDetection() {
        return true;
    }

    @Override
    public TranslationResult translate(String sourceLanguage, String targetLanguage, List<String> texts) {
        if (texts.isEmpty()) {
            return TranslationResult.empty();
        }

        Map<String, String> result = new LinkedHashMap<>();
        Map<String, String> detected = new LinkedHashMap<>();

        for (int start = 0; start < texts.size(); start += properties.getMaxBatchSize()) {
            List<String> batch = texts.subList(
                    start,
                    Math.min(start + properties.getMaxBatchSize(), texts.size())
            );
            BatchResult batchResult = translateBatch(sourceLanguage, targetLanguage, batch);
            result.putAll(batchResult.translations());
            detected.putAll(batchResult.detectedLanguages());
        }
        return new TranslationResult(result, detected);
    }

    private record BatchResult(Map<String, String> translations, Map<String, String> detectedLanguages) {
    }

    private BatchResult translateBatch(String sourceLanguage, String targetLanguage, List<String> batch) {
        // `build()` (không `.encode()`) để RestTemplate tự encode đúng một lần; nếu encode
        // thủ công ở đây thì chuỗi sẽ bị encode hai lần và dịch vụ trả về "%20" thay vì khoảng trắng.
        String url = UriComponentsBuilder
                .fromHttpUrl(properties.getEndpoint())
                .queryParam("client", "gtx")
                .queryParam("sl", sourceLanguage)
                .queryParam("tl", targetLanguage)
                .queryParam("dt", "t")
                .queryParam("q", String.join(SEPARATOR, batch))
                .build()
                .toUriString();

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        // Endpoint chặn request không có User-Agent giống trình duyệt.
        headers.set(HttpHeaders.USER_AGENT,
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        + "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

        try {
            String body = restTemplate.exchange(url, HttpMethod.GET, new HttpEntity<>(headers), String.class)
                    .getBody();
            if (body == null || body.isBlank()) {
                return new BatchResult(Map.of(), Map.of());
            }
            return parse(body, batch, sourceLanguage);
        } catch (Exception ex) {
            log.warn("[i18n] Google Translate failed ({}->{}): {}",
                    sourceLanguage, targetLanguage, ex.getMessage());
            return new BatchResult(Map.of(), Map.of());
        }
    }

    /**
     * Câu trúc phản hồi: {@code [[["dịch", "nguồn", ...], ["dịch", "nguồn", ...]], ...]}.
     *
     * <p>Phần tử thứ hai của mỗi segment là chính chuỗi gốc, nên được dùng làm khoá để khớp
     * chính xác thay vì dựa vào thứ tự (dịch vụ đôi khi gộp nhiều chuỗi vào một segment).
     */
    private BatchResult parse(String body, List<String> batch, String sourceLanguage) {
        Map<String, String> result = new LinkedHashMap<>();
        Map<String, String> detected = new LinkedHashMap<>();
        try {
            JsonNode root = objectMapper.readTree(body);
            JsonNode segments = root.get(0);
            if (segments == null || !segments.isArray()) {
                return new BatchResult(Map.of(), Map.of());
            }

            for (JsonNode segment : segments) {
                if (segment == null || !segment.isArray() || segment.isEmpty()) {
                    continue;
                }
                String translated = segment.get(0).asText("");
                String original = segment.size() > 1 ? segment.get(1).asText("") : "";
                if (translated.isBlank() || original.isBlank()) {
                    continue;
                }

                // Dịch vụ có thể gộp nhiều chuỗi vào một segment; tách ra rồi ghép cặp.
                String[] sources = original.split(SEPARATOR, -1);
                String[] targets = translated.split(SEPARATOR, -1);
                if (sources.length != targets.length) {
                    continue;
                }

                for (int i = 0; i < sources.length; i++) {
                    String source = sources[i].trim();
                    String target = targets[i].trim();
                    if (source.isEmpty() || target.isEmpty() || source.equals(target)) {
                        // Dịch vụ trả về nguyên văn: coi như dịch thất bại để thử provider khác.
                        continue;
                    }
                    result.put(source, target);
                    detected.put(source, sourceLanguage);
                }
            }
            return new BatchResult(result, detected);
        } catch (Exception ex) {
            log.warn("[i18n] Cannot parse Google Translate response: {}", ex.getMessage());
            return new BatchResult(Map.of(), Map.of());
        }
    }
}
