package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.dto.ResolvedReviewFindingTarget;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContextBuilder;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.ReviewFindingInput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.AIReviewSuggestionResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ReviewSuggestionOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.prompt.ReviewSuggestionPrompt;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmProvider;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmRequest;
import com.example.starter_project_2025.system.project.aiassistant.provider.LlmResponse;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.ReviewSuggestionOutputParser;
import com.example.starter_project_2025.system.project.aiassistant.service.review.ReviewFindingTargetResolver;
import com.example.starter_project_2025.system.project.aiassistant.validator.ReviewSuggestionOutputValidator;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AIReviewSuggestionService {

    private static final String INVALID_RESPONSE_RATIONALE =
            "The AI response could not be validated as an actionable suggestion.";

    private final AIReviewFindingRepository findings;
    private final AIReviewReportRepository reports;
    private final AIReviewSuggestionRepository suggestions;
    private final ProjectTemplateReviewAccessService reviewAccess;
    private final ProjectTemplateAccessService templateAccess;
    private final ReviewContextBuilder contextBuilder;
    private final ReviewFindingTargetResolver targetResolver;
    private final ReviewSuggestionPrompt prompt;
    private final LlmProvider llmProvider;
    private final ReviewSuggestionOutputParser outputParser;
    private final ReviewSuggestionOutputValidator outputValidator;
    private final RubricCatalogService rubricCatalog;
    private final ObjectMapper objectMapper;

    @Transactional
    public AIReviewSuggestionResponse generate(Long templateId, Long reportId, Long findingId) {
        ProjectTemplate template = reviewAccess.requireReadableTemplate(templateId);
        AIReviewReport report = requireReport(templateId, reportId);
        AIReviewFinding finding = requireFinding(reportId, findingId);
        if (finding.getStatus() == AIReviewFindingStatus.DISMISSED
                || finding.getStatus() == AIReviewFindingStatus.RESOLVED) {
            throw new IllegalStateException("A dismissed or resolved finding cannot produce suggestions");
        }

        ProjectTemplateSnapshot source = report.getSnapshot();
        ReviewContext context = contextBuilder.build(template, source.getId());
        ReviewFindingInput input = toInput(finding);
        ResolvedReviewFindingTarget target = targetResolver.resolve(input, context);
        JsonNode targetContext = toSuggestionTarget(target, finding, template);
        ResolvedReviewFindingTarget validationTarget = target;
        if (finding.getCategory() == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.MILESTONE
                || finding.getCategory() == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.RUBRIC) {
            validationTarget = new ResolvedReviewFindingTarget(
                    target.category(), target.targetType(), target.targetId(),
                    target.templateId(), target.snapshotId(), targetContext);
        }

        LlmResponse response = llmProvider.generate(new LlmRequest(
                prompt.buildSystemInstruction(),
                prompt.buildUserPrompt(input, targetContext)));

        ReviewSuggestionOutput output;
        List<String> errors;
        try {
            output = outputParser.parse(response.content());
            errors = outputValidator.validate(output, input, validationTarget);
            if (output.changes().isEmpty()) {
                errors = append(errors, "Suggestion contains no actionable changes");
            }
        } catch (IllegalArgumentException exception) {
            output = new ReviewSuggestionOutput(
                    INVALID_RESPONSE_RATIONALE,
                    JsonNodeFactory.instance.objectNode());
            errors = List.of(exception.getMessage() == null
                    ? "AI response is invalid"
                    : exception.getMessage());
        }

        AIReviewSuggestion suggestion = AIReviewSuggestion.builder()
                .finding(finding)
                .templateId(templateId)
                .sourceSnapshotId(source.getId())
                .targetType(finding.getTargetType())
                .targetId(finding.getTargetId())
                .rationale(output.rationale())
                .changesJson(write(output.changes()))
                .rawContent(response.content())
                .validationErrorsJson(errors.isEmpty() ? null : write(errors))
                .aiModel(response.model())
                .status(errors.isEmpty() ? SuggestionStatus.PENDING : SuggestionStatus.INVALID)
                .build();

        return toResponse(suggestions.save(suggestion));
    }

    @Transactional(readOnly = true)
    public List<AIReviewSuggestionResponse> listByFinding(
            Long templateId,
            Long reportId,
            Long findingId
    ) {
        reviewAccess.requireReadableTemplate(templateId);
        requireReport(templateId, reportId);
        requireFinding(reportId, findingId);
        return suggestions.findByFinding_IdOrderByCreatedAtDesc(findingId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AIReviewSuggestionResponse get(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId
    ) {
        reviewAccess.requireReadableTemplate(templateId);
        requireReport(templateId, reportId);
        requireFinding(reportId, findingId);
        AIReviewSuggestion suggestion = suggestions.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException("Review suggestion was not found"));
        requireSuggestionScope(suggestion, templateId, findingId);
        return toResponse(suggestion);
    }

    @Transactional
    public AIReviewSuggestionResponse approve(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId
    ) {
        AIReviewSuggestion suggestion = requireManageableSuggestion(
                templateId, reportId, findingId, suggestionId);
        if (!suggestion.getStatus().canTransitionTo(SuggestionStatus.APPROVED)) {
            throw new IllegalStateException("Only PENDING suggestions can be approved");
        }
        suggestion.setStatus(SuggestionStatus.APPROVED);
        suggestion.setApprovedBy(reviewAccess.requireReviewUser().getId());
        return toResponse(suggestions.save(suggestion));
    }

    @Transactional
    public AIReviewSuggestionResponse reject(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId,
            String reason
    ) {
        AIReviewSuggestion suggestion = requireManageableSuggestion(
                templateId, reportId, findingId, suggestionId);
        if (!suggestion.getStatus().canTransitionTo(SuggestionStatus.REJECTED)) {
            throw new IllegalStateException("Only PENDING suggestions can be rejected");
        }
        suggestion.setStatus(SuggestionStatus.REJECTED);
        suggestion.setRejectionReason(reason);
        suggestion.setRejectedBy(reviewAccess.requireReviewUser().getId());
        return toResponse(suggestions.save(suggestion));
    }

    @Transactional
    public void invalidate(AIReviewSuggestion suggestion, String reason) {
        if (suggestion.getStatus() == SuggestionStatus.INVALID) {
            return;
        }
        if (suggestion.getStatus() != SuggestionStatus.APPROVED) {
            throw new IllegalStateException("Only APPROVED suggestions can become INVALID during apply");
        }
        suggestion.setStatus(SuggestionStatus.INVALID);
        suggestion.setValidationErrorsJson(write(List.of(reason)));
        suggestions.save(suggestion);
    }

    @Transactional(readOnly = true)
    public AIReviewSuggestion requireForApply(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId
    ) {
        AIReviewSuggestion suggestion = requireManageableSuggestion(
                templateId, reportId, findingId, suggestionId);
        if (suggestion.getStatus() != SuggestionStatus.APPROVED) {
            throw new IllegalStateException("Only APPROVED suggestions can be applied");
        }
        return suggestion;
    }

    @Transactional
    public AIReviewSuggestionResponse markApplied(AIReviewSuggestion suggestion, Long snapshotId) {
        if (!suggestion.getStatus().canTransitionTo(SuggestionStatus.APPLIED)) {
            throw new IllegalStateException("Only APPROVED suggestions can be marked APPLIED");
        }
        suggestion.setStatus(SuggestionStatus.APPLIED);
        suggestion.setAppliedSnapshotId(snapshotId);
        suggestion.setAppliedBy(templateAccess.requireReviewUser().getId());
        return toResponse(suggestions.save(suggestion));
    }

    private AIReviewSuggestion requireManageableSuggestion(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId
    ) {
        reviewAccess.requireReadableTemplate(templateId);
        requireReport(templateId, reportId);
        requireFinding(reportId, findingId);
        AIReviewSuggestion suggestion = suggestions.findByIdForUpdate(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException("Review suggestion was not found"));
        requireSuggestionScope(suggestion, templateId, findingId);
        return suggestion;
    }

    private AIReviewReport requireReport(Long templateId, Long reportId) {
        return reports.findByIdAndProjectTemplate_Id(reportId, templateId)
                .orElseThrow(() -> new EntityNotFoundException("Review report was not found"));
    }

    private AIReviewFinding requireFinding(Long reportId, Long findingId) {
        return findings.findByIdAndReport_Id(findingId, reportId)
                .orElseThrow(() -> new EntityNotFoundException("Review finding was not found"));
    }

    private void requireSuggestionScope(
            AIReviewSuggestion suggestion,
            Long templateId,
            Long findingId
    ) {
        if (!templateId.equals(suggestion.getTemplateId())
                || !findingId.equals(suggestion.getFinding().getId())
                || !templateId.equals(suggestion.getFinding().getReport().getProjectTemplate().getId())) {
            throw new EntityNotFoundException("Review suggestion was not found");
        }
    }

    private ReviewFindingInput toInput(AIReviewFinding finding) {
        return new ReviewFindingInput(
                finding.getCategory(),
                finding.getSeverity(),
                finding.getTitle(),
                finding.getDescription(),
                finding.getRecommendation(),
                finding.getTargetType(),
                finding.getTargetId());
    }

    public JsonNode toSuggestionTarget(
            ResolvedReviewFindingTarget target,
            AIReviewFinding finding,
            ProjectTemplate template
    ) {
        JsonNode context = objectMapper.valueToTree(target.target());
        String rubricVersionId = switch (finding.getCategory()) {
            case RUBRIC -> finding.getTargetId();
            case MILESTONE -> context.path("rubricVersionId").asText("");
            default -> "";
        };
        if (rubricVersionId.isBlank()) return context;

        UUID versionId;
        try {
            versionId = UUID.fromString(rubricVersionId);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("Finding references an invalid rubric version", exception);
        }
        RubricVersion version = rubricCatalog.findByIdForTenant(versionId, template.getTenantId())
                .orElseThrow(() -> new EntityNotFoundException("Rubric version was not found"));
        if (!(context instanceof ObjectNode targetObject)) {
            throw new IllegalStateException("Suggestion target context must be a JSON object");
        }
        ObjectNode rubric = targetObject.putObject("editableRubric");
        rubric.put("rubricVersionId", version.getId().toString());
        var criteria = rubric.putArray("criteria");
        for (var criterion : version.getCriteria()) {
            ObjectNode value = criteria.addObject();
            value.put("id", criterion.getId().toString());
            value.put("code", criterion.getCode());
            value.put("name", criterion.getName());
            if (criterion.getDescription() == null) value.putNull("description");
            else value.put("description", criterion.getDescription());
            value.put("weight", criterion.getWeight());
            value.put("maxScore", criterion.getMaxScore());
            value.put("orderIndex", criterion.getOrderIndex());
            var ratings = value.putArray("ratings");
            criterion.getRatings().forEach(rating -> {
                ObjectNode ratingValue = ratings.addObject();
                ratingValue.put("level", rating.getLevel().name());
                ratingValue.put("description", rating.getDescription());
            });
        }
        return targetObject;
    }

    private List<String> append(List<String> values, String value) {
        java.util.ArrayList<String> result = new java.util.ArrayList<>(values);
        result.add(value);
        return List.copyOf(result);
    }

    private String write(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize review suggestion data", exception);
        }
    }

    public AIReviewSuggestionResponse toResponse(AIReviewSuggestion suggestion) {
        JsonNode changes;
        try {
            changes = objectMapper.readTree(suggestion.getChangesJson());
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Stored review suggestion changes are invalid JSON", exception);
        }
        List<String> errors = List.of();
        if (suggestion.getValidationErrorsJson() != null) {
            try {
                errors = objectMapper.readValue(
                        suggestion.getValidationErrorsJson(),
                        objectMapper.getTypeFactory().constructCollectionType(List.class, String.class));
            } catch (JsonProcessingException exception) {
                throw new IllegalStateException("Stored review suggestion validation details are invalid JSON", exception);
            }
        }
        return new AIReviewSuggestionResponse(
                suggestion.getId(),
                suggestion.getFinding().getId(),
                suggestion.getTemplateId(),
                suggestion.getSourceSnapshotId(),
                suggestion.getTargetType(),
                suggestion.getTargetId(),
                suggestion.getRationale(),
                changes,
                suggestion.getStatus(),
                errors,
                suggestion.getRejectionReason(),
                suggestion.getAppliedSnapshotId(),
                suggestion.getCreatedBy(),
                suggestion.getCreatedAt(),
                suggestion.getUpdatedAt());
    }
}
