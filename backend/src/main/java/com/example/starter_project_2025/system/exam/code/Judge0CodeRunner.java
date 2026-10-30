package com.example.starter_project_2025.system.exam.code;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.client.RestTemplateBuilder;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/** Goi Judge0 (chay bang Docker, xem docker/judge0). */
@Slf4j
@Component
public class Judge0CodeRunner implements CodeRunner {

    private final RestTemplate restTemplate;
    private final ObjectMapper mapper = new ObjectMapper();
    private final String baseUrl;
    private final String token;
    private final int languageId;
    private final double cpuTimeLimit;
    private final int memoryLimitKb;

    public Judge0CodeRunner(
            RestTemplateBuilder builder,
            @Value("${code.judge.url:http://localhost:2358}") String baseUrl,
            @Value("${code.judge.token:}") String token,
            @Value("${code.judge.language-id:62}") int languageId,
            @Value("${code.judge.cpu-time-limit-seconds:5}") double cpuTimeLimit,
            @Value("${code.judge.memory-limit-kb:512000}") int memoryLimitKb,
            @Value("${code.judge.read-timeout-ms:30000}") int readTimeoutMs
    ) {
        this.restTemplate = builder
                .setConnectTimeout(Duration.ofSeconds(5))
                .setReadTimeout(Duration.ofMillis(readTimeoutMs))
                .build();
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        this.token = token;
        this.languageId = languageId;
        this.cpuTimeLimit = cpuTimeLimit;
        this.memoryLimitKb = memoryLimitKb;
    }

    @Override
    public RunOutcome run(String javaSource, String stdin) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("source_code", b64(javaSource));
        body.put("language_id", languageId);
        body.put("stdin", b64(stdin == null ? "" : stdin));
        body.put("cpu_time_limit", cpuTimeLimit);
        body.put("wall_time_limit", cpuTimeLimit * 3);
        body.put("memory_limit", memoryLimitKb);
        body.put("enable_network", false);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null && !token.isBlank()) {
            headers.set("X-Auth-Token", token);
        }

        try {
            String raw = restTemplate.postForObject(
                    baseUrl + "/submissions?base64_encoded=true&wait=true",
                    new HttpEntity<>(body, headers),
                    String.class);
            if (raw == null) {
                return RunOutcome.infra("Judge0 không trả kết quả");
            }
            JsonNode n = mapper.readTree(raw);
            JsonNode status = n.path("status");
            return new RunOutcome(
                    false,
                    status.path("id").asInt(-1),
                    status.path("description").asText(""),
                    d64(n.path("stdout")),
                    d64(n.path("stderr")),
                    d64(n.path("compile_output")));
        } catch (Exception e) {
            log.warn("Judge0 call failed: {}", e.toString());
            return RunOutcome.infra("Không kết nối được máy chấm code");
        }
    }

    private static String b64(String s) {
        return Base64.getEncoder().encodeToString(s.getBytes(StandardCharsets.UTF_8));
    }

    private static String d64(JsonNode node) {
        if (node == null || node.isNull() || node.isMissingNode() || node.asText().isEmpty()) return "";
        try {
            return new String(Base64.getMimeDecoder().decode(node.asText()), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return "";
        }
    }
}
