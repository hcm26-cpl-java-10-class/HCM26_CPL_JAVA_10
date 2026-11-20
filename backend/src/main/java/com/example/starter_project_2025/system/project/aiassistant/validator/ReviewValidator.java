package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewNodeContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;
import com.example.starter_project_2025.system.project.aiassistant.enums.ReviewNodeType;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ReviewValidator {

    public void validate(
            AIReviewOutput output,
            ReviewNodeContext context,
            ReviewNodeType nodeType
    ) {
        validateStructure(output);
        validateFindings(output.findings(), context, nodeType);
    }

    private void validateStructure(AIReviewOutput output) {
        if (output == null) {
            throw new IllegalArgumentException("AI review output must not be null");
        }

        if (output.summary() == null || output.summary().isBlank()) {
            throw new IllegalArgumentException("AI review summary must not be empty");
        }

        if (output.findings() == null) {
            throw new IllegalArgumentException("AI review findings must not be null");
        }
    }


    private void validateCategory(String category, ReviewNodeType nodeType) {
        try {
            AIReviewFindingCategory.valueOf(category);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalArgumentException(
                    "Invalid AI review finding category: " + category
            );
        }

        if (("PROJECT_TEMPLATE".equals(category)
                && nodeType != ReviewNodeType.ROOT)
                || ("MODULE".equals(category)
                && nodeType != ReviewNodeType.MODULE)) {
            throw new IllegalArgumentException(
                    "Finding category does not match the current review node"
            );
        }
    }

    private void validateSeverity(String severity) {
        try {
            AIReviewFindingSeverity.valueOf(severity);
        } catch (IllegalArgumentException | NullPointerException exception) {
            throw new IllegalArgumentException(
                    "Invalid AI review finding severity: " + severity
            );
        }
    }

    private void validateFindings(
            List<AIReviewFindingOutput> findings,
            ReviewNodeContext context,
            ReviewNodeType nodeType
    ) {
        if (context == null) {
            throw new IllegalArgumentException(
                    "Review context must not be null"
            );
        }
        for (AIReviewFindingOutput finding : findings) {
            if (finding == null) {
                throw new IllegalArgumentException(
                        "AI review finding must not be null"
                );
            }

            validateCategory(finding.category(),nodeType);
            validateSeverity(finding.severity());
            validateRequiredFields(finding);
            validateTargetType(finding);
            validateTargetId(finding, context);
        }
    }

    private void validateRequiredFields(AIReviewFindingOutput finding) {
        if (finding.title() == null || finding.title().isBlank()) {
            throw new IllegalArgumentException("Finding title must not be empty");
        }

        if (finding.description() == null || finding.description().isBlank()) {
            throw new IllegalArgumentException("Finding description must not be empty");
        }

        if (finding.recommendation() == null || finding.recommendation().isBlank()) {
            throw new IllegalArgumentException(
                    "Finding recommendation must not be empty"
            );
        }

        if (finding.targetType() == null || finding.targetType().isBlank()) {
            throw new IllegalArgumentException("Finding targetType must not be empty");
        }

        if (finding.targetId() == null || finding.targetId().isBlank()) {
            throw new IllegalArgumentException("Finding targetId must not be empty");
        }
    }


    private void validateTargetType(AIReviewFindingOutput finding) {
        AIReviewFindingCategory category =
                AIReviewFindingCategory.valueOf(finding.category());

        String expectedTargetType = switch (category) {
            case PROJECT_TEMPLATE, MODULE -> "PROJECT_TEMPLATE";
            case MILESTONE -> "TEMPLATE_MILESTONE";
            case BACKLOG -> "TEMPLATE_BACKLOG_ITEM";
            case RUBRIC -> "RUBRIC_VERSION";
            case DOCUMENT -> "TEMPLATE_RESOURCE";
        };

        if (!expectedTargetType.equals(finding.targetType())) {
            throw new IllegalArgumentException(
                    "Invalid targetType for category " + category
            );
        }
    }


    private boolean containsId(List<JsonNode> items, String targetId) {
        return items != null && items.stream()
                .filter(JsonNode::isObject)
                .map(item -> item.get("id"))
                .filter(id -> id != null && !id.isNull())
                .anyMatch(id -> targetId.equals(id.asText()));
    }
    //item là danh sách milestone hoặc backlog trong snapshot


    private void validateTargetId(
            AIReviewFindingOutput finding,
            ReviewNodeContext context
    ) {
        String targetId = finding.targetId();

        boolean exists = switch (finding.targetType()) {
            case "PROJECT_TEMPLATE" ->
                    targetId.equals(String.valueOf(context.templateId()));

            case "TEMPLATE_MILESTONE" ->
                    containsId(context.milestones(), targetId);

            case "TEMPLATE_BACKLOG_ITEM" ->
                    containsId(context.backlogItems(), targetId);

            case "RUBRIC_VERSION" ->
                    context.rubrics().stream()
                            .anyMatch(rubric -> targetId.equals(
                                    rubric.rubricVersionId().toString()
                            ));

            case "TEMPLATE_RESOURCE" ->
                    context.resources().stream()
                            .anyMatch(resource -> targetId.equals(
                                    String.valueOf(resource.resourceId())
                            ));

            default -> false;
        };

        if (!exists) {
            throw new IllegalArgumentException(
                    "Finding targetId does not exist in review context: "
                            + finding.targetType() + " / " + targetId
            );
        }
    }

    //Cấu trúc AIReviewOutput.
    //Category có thuộc enum.
    //Severity có thuộc enum.
    //Các trường bắt buộc và mapping Category – TargetType.
    //targetId có tồn tại trong ReviewNodeContext.

}
