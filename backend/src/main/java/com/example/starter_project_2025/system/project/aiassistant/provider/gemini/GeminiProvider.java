package com.example.starter_project_2025.system.project.aiassistant.provider.gemini;

import com.example.starter_project_2025.system.project.aiassistant.config.GeminiProperties;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
public class GeminiProvider implements LlmProvider {

    private final GeminiProperties properties;
    private final RestClient restClient;
    private final ObjectMapper objectMapper;

    public GeminiProvider(
            GeminiProperties properties,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        int timeoutMillis = properties.getTimeoutSeconds() * 1000;
        requestFactory.setConnectTimeout(timeoutMillis);
        requestFactory.setReadTimeout(timeoutMillis);

        // Đảm bảo baseUrl là: https://generativelanguage.googleapis.com
        this.restClient = RestClient.builder()
                .baseUrl(properties.getBaseUrl())
                .requestFactory(requestFactory)
                .build();
    }

    @Override
    public LlmResponse generate(LlmRequest request) {

        if (properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            throw new IllegalStateException("Gemini API key is not configured");
        }

        Map<String, Object> requestBody = new HashMap<>();

        if (request.systemInstruction() != null && !request.systemInstruction().isBlank()) {
            requestBody.put("systemInstruction", Map.of(
                    "parts", List.of(Map.of("text", request.systemInstruction()))
            ));
        }

        requestBody.put("contents", List.of(
                Map.of(
                        "role", "user",
                        "parts", List.of(Map.of("text", request.userPrompt()))
                )
        ));

        try {
            return restClient.post()
                    // Gemini hỗ trợ nhận key qua query param ?key=
                    .uri(uriBuilder -> uriBuilder
                            .path("/v1beta/models/{model}:generateContent")
                            .queryParam("key", properties.getApiKey())
                            .build(properties.getModel()))
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .exchange((req, res) -> {
                        HttpStatusCode status = res.getStatusCode();

                        // Đọc raw bytes trực tiếp từ response stream, tránh lỗi MessageConverter
                        byte[] bodyBytes;
                        try (InputStream is = res.getBody()) {
                            bodyBytes = is.readAllBytes();
                        }

                        String rawResponse = new String(bodyBytes, StandardCharsets.UTF_8);

                        // Nếu Google trả về lỗi (4xx, 5xx) -> in rõ ràng lỗi từ Google ra để debug
                        if (status.isError()) {
                            throw new IllegalStateException(
                                    "Gemini API error (HTTP " + status.value() + "): " + rawResponse
                            );
                        }

                        JsonNode response = objectMapper.readTree(rawResponse);
                        JsonNode textNode = response.at("/candidates/0/content/parts/0/text");

                        if (textNode.isMissingNode() || textNode.isNull() || textNode.asText().isBlank()) {
                            throw new IllegalStateException(
                                    "Gemini response does not contain generated text: " + rawResponse
                            );
                        }

                        String actualModel = response.hasNonNull("modelVersion")
                                ? response.get("modelVersion").asText()
                                : properties.getModel();

                        return new LlmResponse(textNode.asText(), actualModel);
                    });

        } catch (ResourceAccessException ex) {
            throw new IllegalStateException("Cannot connect to Gemini API or request timed out", ex);
        } catch (IllegalStateException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to process Gemini API call: " + ex.getMessage(), ex);
        }
    }
}