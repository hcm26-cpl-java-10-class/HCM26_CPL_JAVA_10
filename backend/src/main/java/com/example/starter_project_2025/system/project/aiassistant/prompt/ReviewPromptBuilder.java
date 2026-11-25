
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
                   - Review milestone planning fields and its rubric reference.
                3. Backlog:
                   - Completeness, clarity and feasibility.
                   - Alignment with milestones.
                4. Rubrics:
                   - Alignment with milestones and learning objectives.
                   - Criteria, weights, maximum scores and rating levels.
                   - Consistency and completeness of scoring structure.

                Milestone and rubric data are related but are not interchangeable:
                - A milestone's rubricVersionId references a Rubric Version.
                - The canonical rubric criteria are supplied in the top-level
                  rubrics list (or the current module's rubrics list), in the
                  Rubric object whose rubricVersionId matches the milestone's
                  rubricVersionId.
                - Use that matched Rubric object's criteria to assess the
                  milestone's rubric. Do not expect milestone.rubricCriteria
                  to contain a duplicate copy of those criteria.
                - An empty or missing inline milestone.rubricCriteria array by
                  itself is not a defect and must not produce a finding.
                - Report missing or incomplete rubric criteria only when the
                  matched Rubric object actually has missing or incomplete
                  criteria. If the milestone has a rubricVersionId but no
                  matching Rubric object is supplied, do not assume the rubric
                  has no criteria; report only a verifiable reference/context
                  issue, if appropriate.
                - Findings about milestone planning or a missing/invalid
                  milestone reference must target the milestone using its id
                  and TEMPLATE_MILESTONE. Findings about rubric criteria must
                  target the matching Rubric Version using its rubricVersionId
                  and RUBRIC_VERSION.
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
                Suggestion capability classification:
                Every finding must include a structured suggestionCapability and
                suggestionCapabilityReason. Use AUTO_EDITABLE only when the finding
                can be addressed by editing its existing target using operations
                supported by the suggestion prompt. Use MANUAL_REQUIRED when the
                recommendation requires creating a new high-level module or milestone,
                or creating an independent Rubric Version. Explain the unsupported
                operation in suggestionCapabilityReason.
                A rubric criterion change on an existing rubric is AUTO_EDITABLE:
                applying it creates a new Rubric Version internally. Do not mark it
                MANUAL_REQUIRED merely because applying criteria changes versions.
                Do not classify a finding as MANUAL_REQUIRED simply because it is
                about a milestone, module, or rubric; classify by the operation needed.

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
                      "suggestionCapability": "AUTO_EDITABLE",
                      "suggestionCapabilityReason": "The existing target can be updated with supported suggestion operations.",
                      "targetType": "PROJECT_TEMPLATE",
                      "targetId": "123"
                    }
                  ]
                }

                All fields are required.
                category, severity and targetType must use exact allowed values.
                suggestionCapability must be AUTO_EDITABLE or MANUAL_REQUIRED.
                suggestionCapabilityReason must be a concise, non-empty explanation
                of why the recommendation is or is not supported by suggestion apply.
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
