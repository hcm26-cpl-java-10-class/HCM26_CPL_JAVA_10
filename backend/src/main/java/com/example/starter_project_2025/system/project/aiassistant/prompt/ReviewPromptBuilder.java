
package com.example.starter_project_2025.system.project.aiassistant.prompt;

import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewNodeContext;
import com.example.starter_project_2025.system.project.aiassistant.enums.ReviewNodeType;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class ReviewPromptBuilder {

    private final ObjectMapper objectMapper;

    public LlmRequest build(
            ReviewNodeContext context,
            ReviewNodeType nodeType
    ) {
        return new LlmRequest(
                buildSystemInstruction(nodeType),
                buildUserPrompt(context, nodeType)
        );
    }

    private String buildSystemInstruction(ReviewNodeType nodeType) {
        return """
                You are an experienced software project management reviewer.

                You are currently reviewing a %s node.

                %s

                Your task is to review a Project Template and identify
                concrete problems in its structure and content.

                Review the following areas:
                1. Project Template information:
                   - Name, description, technology stack, category and level.
                   - Estimated duration and constraints.
                2. Milestones:
                   - Completeness, ordering, scope and feasibility.
                   - Alignment with project objectives.
                3. Backlog:
                   - Completeness, clarity and feasibility.
                   - Alignment with milestones.
                4. Rubrics:
                   - Alignment with milestones and learning objectives.
                   - Criteria, weights, maximum scores and rating levels.
                   - Consistency and completeness of scoring structure.
                5. Documents and Resources:
                   - Relevance and usefulness to the project.
                   - Completeness of descriptions and resource information.
                6. Modules:
                   - Review the current node's information when available.
                   - Do not invent information about child modules that
                     is not included in the input.

                Review principles:
                - Only use information provided in the input.
                - Do not invent facts, entities, IDs or missing content.
                - Do not treat missing information as confirmed facts.
                - Distinguish actual problems from suggestions for improvement.
                - Avoid vague or generic findings.
                - Each finding must identify a concrete target.
                - Do not create findings for aspects that have no identifiable issue.
                - If no issues are found, return an empty findings array.
                - Do not access or assume the content of resource URLs.

                Allowed category values:
                PROJECT_TEMPLATE, MODULE, MILESTONE, BACKLOG, RUBRIC, DOCUMENT.

                Allowed severity values:
                CRITICAL, HIGH, MEDIUM, LOW.

                Allowed targetType values:
                PROJECT_TEMPLATE,
                TEMPLATE_MILESTONE,
                TEMPLATE_BACKLOG_ITEM,
                RUBRIC_VERSION,
                TEMPLATE_RESOURCE.

                Target mapping:
                - PROJECT_TEMPLATE: the current template ID.
                - MODULE: the current module's template ID, with targetType PROJECT_TEMPLATE.
                - MILESTONE: the milestone ID, with targetType TEMPLATE_MILESTONE.
                - BACKLOG: the backlog item ID, with targetType TEMPLATE_BACKLOG_ITEM.
                - RUBRIC: the rubricVersionId, with targetType RUBRIC_VERSION.
                - DOCUMENT: the resourceId, with targetType TEMPLATE_RESOURCE.

                Never invent targetId values.
                Use only IDs present in the input.
                If an issue cannot be associated with a valid target ID,
                do not create that finding.

                Return JSON only. Do not use Markdown code fences
                or include explanations outside the JSON.

                The output must follow this exact structure:
                {
                  "summary": "Overall review summary",
                  "findings": [
                    {
                      "category": "PROJECT_TEMPLATE",
                      "severity": "HIGH",
                      "title": "Short issue title",
                      "description": "Detailed explanation",
                      "recommendation": "Concrete improvement recommendation",
                      "targetType": "PROJECT_TEMPLATE",
                      "targetId": "123"
                    }
                  ]
                }

                All fields are required.
                category, severity and targetType must use exact allowed values.
                targetId must be a string.
                """.formatted(
                nodeType == ReviewNodeType.ROOT
                        ? "ROOT TEMPLATE"
                        : "MODULE",
                nodeType == ReviewNodeType.ROOT
                        ? "For issues about the current template itself, use category PROJECT_TEMPLATE."
                        : "For issues about the current module itself, use category MODULE."
        );
    }

    private String buildUserPrompt(
            ReviewNodeContext context,
            ReviewNodeType nodeType
    ) {
        try {
            String contextJson = objectMapper.writeValueAsString(context);

            return """
                    Review the following %s.

                    Identify concrete issues based only on the supplied data.
                    Return your result using the required JSON structure.

                    Project Template data:
                    %s
                    """.formatted(
                    nodeType == ReviewNodeType.ROOT
                            ? "ROOT TEMPLATE"
                            : "MODULE",
                    contextJson
            );

        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to serialize review context", exception
            );
        }
    }
}
