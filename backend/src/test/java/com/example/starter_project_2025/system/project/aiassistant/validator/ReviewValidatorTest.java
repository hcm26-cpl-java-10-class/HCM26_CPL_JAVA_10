package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewNodeContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.enums.ReviewNodeType;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ReviewValidatorTest {

    private final ReviewValidator validator = new ReviewValidator();
    private final ReviewNodeContext context = new ReviewNodeContext(
            12L, 1, "T-12", "Template", "Description", "Java",
            "Education", "Beginner", 10, new ObjectMapper().createObjectNode(),
            List.of(), List.of(), List.of(), List.of());

    @Test
    void acceptsBothStructuredSuggestionCapabilityValues() {
        assertDoesNotThrow(() -> validator.validate(
                output("AUTO_EDITABLE", "The existing template fields can be updated."),
                context,
                ReviewNodeType.ROOT));
        assertDoesNotThrow(() -> validator.validate(
                output("MANUAL_REQUIRED", "This recommendation requires creating a new milestone."),
                context,
                ReviewNodeType.ROOT));
    }

    @Test
    void rejectsMissingOrInvalidSuggestionCapability() {
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                output(null, "Missing capability"),
                context,
                ReviewNodeType.ROOT));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                output("UNSUPPORTED", "Invalid capability"),
                context,
                ReviewNodeType.ROOT));
        assertThrows(IllegalArgumentException.class, () -> validator.validate(
                output("MANUAL_REQUIRED", " "),
                context,
                ReviewNodeType.ROOT));
    }

    private AIReviewOutput output(String capability, String reason) {
        return new AIReviewOutput("Review summary", List.of(new AIReviewFindingOutput(
                "PROJECT_TEMPLATE",
                "MEDIUM",
                "Improve template overview",
                "The template overview is incomplete.",
                "Update the description.",
                capability,
                reason,
                "PROJECT_TEMPLATE",
                "12")));
    }
}
