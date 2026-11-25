
package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReviewOutputParser {

    private final ObjectMapper objectMapper;

    public AIReviewOutput parse(String content) {
        try {
            return objectMapper.readValue(content, AIReviewOutput.class);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to parse AI review output", exception
            );
        }
    }
}
