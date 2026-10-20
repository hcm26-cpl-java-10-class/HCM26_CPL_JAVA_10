package com.example.starter_project_2025.system.exam.service.ai;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.dto.EssayGradingDTO;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiEssayGradingClient {

    private final AiGradingProperties properties;
    private final ObjectMapper objectMapper;

    public record EssayQuestionPayload(
            Long questionId,
            int displayOrder,
            String questionContent,
            int maxPoints,
            String studentAnswer
    ) {}

    public EssayGradingDTO.AiGradingResponse requestProposal(List<EssayQuestionPayload> payloads) {
        if (!properties.isEnabled() || properties.getApiKey() == null || properties.getApiKey().isBlank()) {
            throw new BadRequestException(
                    "AI grading provider is not configured. Missing required configuration: app.ai.api-key. " +
                    "Please configure app.ai.api-key in application.properties or set the AI_API_KEY environment variable."
            );
        }

        if (payloads == null || payloads.isEmpty()) {
            EssayGradingDTO.AiGradingResponse empty = new EssayGradingDTO.AiGradingResponse();
            empty.setProposals(List.of());
            return empty;
        }

        RestTemplate restTemplate = buildRestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(properties.getApiKey().trim());

        String prompt = buildPrompt(payloads);

        Map<String, Object> requestBody = Map.of(
                "model", properties.getModel(),
                "messages", List.of(
                        Map.of("role", "system", "content", "You are an expert academic evaluator. Grade student essay responses objectively based on question context and maximum points. Always return valid JSON only."),
                        Map.of("role", "user", "content", prompt)
                ),
                "temperature", 0.2
        );

        HttpEntity<Map<String, Object>> requestEntity = new HttpEntity<>(requestBody, headers);

        try {
            ResponseEntity<String> response = restTemplate.postForEntity(
                    properties.getEndpoint(),
                    requestEntity,
                    String.class
            );

            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                throw new BadRequestException("AI provider returned status " + response.getStatusCode());
            }

            return parseAiResponse(response.getBody(), payloads);

        } catch (ResourceAccessException e) {
            log.error("AI grading provider request timed out or network error", e);
            throw new BadRequestException("AI provider request timed out. Please try again or grade manually.");
        } catch (RestClientException e) {
            log.error("AI grading provider request failed", e);
            throw new BadRequestException("AI provider request failed: " + e.getMessage());
        } catch (Exception e) {
            log.error("Failed to parse AI grading response", e);
            if (e instanceof BadRequestException) {
                throw (BadRequestException) e;
            }
            throw new BadRequestException("Malformed or unparseable response from AI provider: " + e.getMessage());
        }
    }

    private String buildPrompt(List<EssayQuestionPayload> payloads) {
        StringBuilder sb = new StringBuilder();
        sb.append("Please evaluate the following essay questions and student answers.\n");
        sb.append("Requirements:\n");
        sb.append("- For each question, propose a score from 0 up to maxPoints.\n");
        sb.append("- Provide constructive feedback explaining what was correct, missing, or incorrect.\n");
        sb.append("- Output must be strictly valid JSON matching this exact structure with no extra text or markdown formatting:\n");
        sb.append("{\n");
        sb.append("  \"proposals\": [\n");
        sb.append("    {\n");
        sb.append("      \"questionId\": 123,\n");
        sb.append("      \"proposedScore\": 4,\n");
        sb.append("      \"feedback\": \"Good explanation of concepts...\",\n");
        sb.append("      \"reasoning\": \"Student addressed all key points...\"\n");
        sb.append("    }\n");
        sb.append("  ]\n");
        sb.append("}\n\n");
        sb.append("Questions to evaluate:\n");

        for (EssayQuestionPayload payload : payloads) {
            sb.append("---\n");
            sb.append("Question ID: ").append(payload.questionId()).append("\n");
            sb.append("Order: ").append(payload.displayOrder()).append("\n");
            sb.append("Question: ").append(payload.questionContent()).append("\n");
            sb.append("Max Points: ").append(payload.maxPoints()).append("\n");
            sb.append("Student Answer: ")
                    .append(payload.studentAnswer() != null && !payload.studentAnswer().isBlank()
                            ? payload.studentAnswer()
                            : "[No answer provided]")
                    .append("\n");
        }

        return sb.toString();
    }

    private EssayGradingDTO.AiGradingResponse parseAiResponse(String responseJson, List<EssayQuestionPayload> payloads) throws Exception {
        JsonNode root = objectMapper.readTree(responseJson);
        JsonNode choices = root.path("choices");
        if (!choices.isArray() || choices.isEmpty()) {
            throw new BadRequestException("Invalid response format from AI provider (missing choices)");
        }

        String content = choices.get(0).path("message").path("content").asText();
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Empty content received from AI provider");
        }

        // Clean any markdown formatting e.g. ```json ... ```
        String cleanedContent = content.trim();
        if (cleanedContent.startsWith("```json")) {
            cleanedContent = cleanedContent.substring(7);
        } else if (cleanedContent.startsWith("```")) {
            cleanedContent = cleanedContent.substring(3);
        }
        if (cleanedContent.endsWith("```")) {
            cleanedContent = cleanedContent.substring(0, cleanedContent.length() - 3);
        }
        cleanedContent = cleanedContent.trim();

        JsonNode parsedJson = objectMapper.readTree(cleanedContent);
        JsonNode proposalsNode = parsedJson.path("proposals");

        Map<Long, EssayQuestionPayload> payloadMap = new HashMap<>();
        for (EssayQuestionPayload p : payloads) {
            payloadMap.put(p.questionId(), p);
        }

        List<EssayGradingDTO.AiQuestionProposal> proposals = new ArrayList<>();
        if (proposalsNode.isArray()) {
            for (JsonNode item : proposalsNode) {
                Long qId = item.path("questionId").asLong();
                EssayQuestionPayload payload = payloadMap.get(qId);
                int maxPoints = payload != null ? payload.maxPoints() : 100;

                int rawScore = item.path("proposedScore").asInt(0);
                // Validate score bounds: 0 <= score <= maxPoints
                int validScore = Math.max(0, Math.min(rawScore, maxPoints));

                EssayGradingDTO.AiQuestionProposal proposal = new EssayGradingDTO.AiQuestionProposal();
                proposal.setQuestionId(qId);
                proposal.setProposedScore(validScore);
                proposal.setFeedback(item.path("feedback").asText(""));
                proposal.setReasoning(item.path("reasoning").asText(""));
                proposals.add(proposal);
            }
        }

        EssayGradingDTO.AiGradingResponse result = new EssayGradingDTO.AiGradingResponse();
        result.setProposals(proposals);
        return result;
    }

    private RestTemplate buildRestTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        int timeoutMs = Math.max(1, properties.getTimeoutSeconds()) * 1000;
        factory.setConnectTimeout(timeoutMs);
        factory.setReadTimeout(timeoutMs);
        return new RestTemplate(factory);
    }
}
