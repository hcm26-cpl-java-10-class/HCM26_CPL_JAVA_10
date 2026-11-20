package com.example.starter_project_2025.system.project.aiassistant.service.apply;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.aiassistant.dto.ResolvedReviewFindingTarget;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContextBuilder;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.ReviewFindingInput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.AIReviewSuggestionApplyResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.AIReviewSuggestionResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ReviewSuggestionOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import com.example.starter_project_2025.system.project.aiassistant.service.review.AIReviewSuggestionService;
import com.example.starter_project_2025.system.project.aiassistant.service.review.ProjectTemplateReviewAccessService;
import com.example.starter_project_2025.system.project.aiassistant.service.review.ReviewFindingTargetResolver;
import com.example.starter_project_2025.system.project.aiassistant.validator.ReviewSuggestionOutputValidator;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotDTO;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRequest;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceVersionService;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceView;
import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.dto.CreateRubricVersionRequest;
import com.example.starter_project_2025.system.project.rubric.dto.RubricCriterionRequest;
import com.example.starter_project_2025.system.project.rubric.dto.RubricRatingRequest;
import com.example.starter_project_2025.system.project.rubric.dto.SaveRubricDraftRequest;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.rubric.service.RubricService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateRequest;
import com.example.starter_project_2025.system.project.template.TemplateTeamConstraints;
import com.example.starter_project_2025.system.project.template.TemplateTeamConstraintsMapper;
import com.example.starter_project_2025.system.project.template.TemplateTeamConstraintsRequest;
import com.example.starter_project_2025.system.project.template.content.TemplateSampleContentRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.project.template.version.TemplateVersionConfigurationService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AIReviewSuggestionApplyService {

    private final ProjectTemplateSnapshotService snapshotService;

    private final ObjectMapper objectMapper;
    private final AIReviewSuggestionService suggestionService;
    private final AIReviewFindingRepository findingRepository;
    private final AIReviewReportRepository reportRepository;
    private final ProjectTemplateSnapshotRepository snapshotRepository;
    private final ProjectTemplateReviewAccessService reviewAccess;
    private final ProjectTemplateAccessService templateAccess;
    private final ReviewContextBuilder contextBuilder;
    private final ReviewFindingTargetResolver targetResolver;
    private final ReviewSuggestionOutputValidator outputValidator;
    private final ProjectTemplateRepository templateRepository;
    private final TemplateVersionConfigurationService versionConfigurations;
    private final TemplateTeamConstraintsMapper teamConstraintsMapper;
    private final TemplateResourceVersionService resourceVersions;
    private final RubricCatalogService rubricCatalog;
    private final RubricVersionRepository rubricVersions;
    private final RubricService rubricService;

    @Transactional
    public AIReviewSuggestionApplyResponse applySuggestion(
            Long templateId,
            Long reportId,
            Long findingId,
            Long suggestionId
    ) {
        templateAccess.requireUser("UPDATE");
        AIReviewSuggestion suggestion = suggestionService.requireForApply(
                templateId, reportId, findingId, suggestionId);
        ProjectTemplate template = reviewAccess.requireReadableTemplate(templateId);
        AIReviewReport report = reportRepository.findByIdAndProjectTemplate_Id(reportId, templateId)
                .orElseThrow(() -> new EntityNotFoundException("Review report was not found"));
        AIReviewFinding finding = findingRepository.findByIdAndReport_Id(findingId, reportId)
                .orElseThrow(() -> new EntityNotFoundException("Review finding was not found"));

        if (finding.getStatus() == AIReviewFindingStatus.DISMISSED
                || finding.getStatus() == AIReviewFindingStatus.RESOLVED) {
            return invalidate(suggestion, "The finding is dismissed or resolved");
        }
        if (!suggestion.getSourceSnapshotId().equals(report.getSnapshot().getId())) {
            return invalidate(suggestion, "The suggestion does not belong to the report snapshot");
        }

        ReviewContext reviewContext = contextBuilder.build(template, report.getSnapshot().getId());
        ReviewFindingInput findingInput = toInput(finding);
        ResolvedReviewFindingTarget target = targetResolver.resolve(findingInput, reviewContext);
        if (!suggestion.getTargetType().equals(finding.getTargetType())
                || !suggestion.getTargetId().equals(finding.getTargetId())
                || !suggestion.getTargetId().equals(target.targetId())
                || !suggestion.getTemplateId().equals(templateId)) {
            return invalidate(suggestion, "The suggestion target no longer matches the finding");
        }
        lockTemplateVersions(report.getSnapshot().getTemplateId(), target.templateId());
        if (!isLatestReusable(report.getSnapshot().getTemplateId(), report.getSnapshot().getId())
                || !isLatestReusable(target.templateId(), target.snapshotId())) {
            return invalidate(suggestion, "The source template or module snapshot is no longer the latest version");
        }
        ResolvedReviewFindingTarget validationTarget = target;
        if (finding.getCategory() == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.MILESTONE
                || finding.getCategory() == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.RUBRIC) {
            JsonNode targetContext = suggestionService.toSuggestionTarget(target, finding, template);
            validationTarget = new ResolvedReviewFindingTarget(
                    target.category(), target.targetType(), target.targetId(),
                    target.templateId(), target.snapshotId(), targetContext);
        }

        ProjectTemplateSnapshot source = snapshotRepository.findById(target.snapshotId())
                .filter(value -> target.templateId().equals(value.getTemplateId())
                        && value.getProjectId() == null
                        && Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(() -> new EntityNotFoundException("Suggestion target snapshot was not found"));
        JsonNode changes = readJson(suggestion.getChangesJson());
        ReviewSuggestionOutput output = new ReviewSuggestionOutput(suggestion.getRationale(), changes);
        List<String> validationErrors = outputValidator.validate(output, findingInput, validationTarget);
        if (!validationErrors.isEmpty()) {
            return invalidate(suggestion, String.join("; ", validationErrors));
        }

        ObjectNode content = readContent(source.getContentJson());
        ObjectNode candidate = content.deepCopy();
        boolean configurationChanged = applyChanges(candidate, changes, finding, target);
        boolean resourcesChanged = changes.has("resources")
                && resourcesWillChange(source.getId(), changes.path("resources"));

        RubricVersion sourceRubric = null;
        boolean applyRubricVersion = false;
        if (requiresRubricVersion(changes)) {
            sourceRubric = sourceRubricVersion(changes, finding, target, template.getTenantId());
            if (rubricVersions.existsByRubricIdAndStatus(
                    sourceRubric.getRubric().getId(), RubricVersionStatus.DRAFT)) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "A draft version of the rubric must be resolved before applying this suggestion");
            }
            applyRubricVersion = rubricWouldChange(sourceRubric, criterionChanges(changes));
            if (!applyRubricVersion && !configurationChanged && !resourcesChanged) {
                return invalidate(suggestion, "The rubric suggestion contains no effective changes");
            }
        }

        if (!configurationChanged && !resourcesChanged && sourceRubric == null) {
            return invalidate(suggestion, "The suggestion does not change the current target");
        }

        ProjectTemplateSnapshotDTO newSnapshot =
                snapshotService.createNewVersionForSuggestion(source.getId());
        if (newSnapshot == null || newSnapshot.getId() == null) {
            throw new IllegalStateException("Could not create a draft snapshot for the suggestion");
        }

        if (applyRubricVersion) {
            UUID newRubricVersionId = createRubricVersion(sourceRubric, criterionChanges(changes));
            updateRubricReferences(candidate, finding, newRubricVersionId);
        }

        if (changes.has("resources")) {
            applyResourceChanges(source.getId(), newSnapshot.getId(), changes.path("resources"));
        } else {
            persistConfigurationChange(newSnapshot.getId(), candidate, changes);
        }

        snapshotService.recordSuggestionVersionCreated(newSnapshot.getId(), source.getId());
        AIReviewSuggestionResponse updatedSuggestion =
                suggestionService.markApplied(suggestion, newSnapshot.getId());
        ProjectTemplateSnapshotDTO savedSnapshot = snapshotService.getById(newSnapshot.getId());
        return new AIReviewSuggestionApplyResponse(updatedSuggestion, savedSnapshot);
    }

    private void applyBacklogItemChanges(
            ObjectNode content,
            JsonNode changes
    ) {
        // 1. Validate backlogChanges
        JsonNode backlogChanges = changes.path("backlogItems");

        if (backlogChanges.isMissingNode()) {
            return;
        }

        if (!backlogChanges.isObject()) {
            throw new IllegalStateException(
                    "backlogItems changes must be a JSON object"
            );
        }

        Set<String> allowedOperations = Set.of(
                "add",
                "update",
                "remove"
        );

        backlogChanges.fieldNames().forEachRemaining(operation -> {
            if (!allowedOperations.contains(operation)) {
                throw new IllegalStateException(
                        "Unsupported backlogItems operation: " + operation
                );
            }
        });

        // 2. Validate operation arrays
        for (String operation : allowedOperations) {
            if (backlogChanges.has(operation)
                    && !backlogChanges.get(operation).isArray()) {
                throw new IllegalStateException(
                        "backlogItems operation must be an array: " + operation
                );
            }
        }

        // 3. Validate existing backlogItems
        JsonNode backlogItemsNode = content.path("backlogItems");

        if (!backlogItemsNode.isArray()) {
            throw new IllegalStateException(
                    "Template backlogItems must be an array"
            );
        }

        ArrayNode backlogItems = (ArrayNode) backlogItemsNode;

        Set<Long> updatedIds = new HashSet<>();
        Set<Long> removedIds = new HashSet<>();

        // 4. ADD
        JsonNode addItems = backlogChanges.path("add");

        if (addItems.isArray()) {
            for (JsonNode item : addItems) {
                if (!item.isObject()) {
                    throw new IllegalStateException(
                            "New backlog item must be an object"
                    );
                }

                if (item.has("id")) {
                    throw new IllegalStateException(
                            "AI must not provide ID for a new backlog item"
                    );
                }

                validateBacklogItemFields(item);

                // Title is mandatory when adding a new backlog item
                JsonNode titleNode = item.get("title");

                if (titleNode == null || titleNode.isNull()) {
                    throw new IllegalStateException(
                            "New backlog item must contain a title"
                    );
                }

                ObjectNode newItem = objectMapper.createObjectNode();

                item.fields().forEachRemaining(entry ->
                        newItem.set(
                                entry.getKey(),
                                entry.getValue().deepCopy()
                        )
                );

                backlogItems.add(newItem);
            }
        }

        // 5. UPDATE
        JsonNode updateItems = backlogChanges.path("update");

        if (updateItems.isArray()) {
            for (JsonNode updateItem : updateItems) {
                if (!updateItem.isObject()) {
                    throw new IllegalStateException(
                            "Updated backlog item must be an object"
                    );
                }

                validateBacklogItemFields(updateItem);

                JsonNode idNode = updateItem.get("id");

                if (idNode == null
                        || !idNode.isIntegralNumber()
                        || !idNode.canConvertToLong()) {
                    throw new IllegalStateException(
                            "Updated backlog item must have a valid ID"
                    );
                }

                long targetId = idNode.asLong();

                if (targetId <= 0) {
                    throw new IllegalStateException(
                            "Updated backlog item ID must be positive"
                    );
                }

                if (updateItem.size() <= 1) {
                    throw new IllegalStateException(
                            "Updated backlog item must contain at least one field to update"
                    );
                }

                // Prevent updating an item that is also being removed
                if (removedIds.contains(targetId)) {
                    throw new IllegalStateException(
                            "Backlog item cannot be both updated and removed: "
                                    + targetId
                    );
                }

                if (!updatedIds.add(targetId)) {
                    throw new IllegalStateException(
                            "Duplicate backlog item ID in update: " + targetId
                    );
                }

                ObjectNode existingItem = findBacklogItemById(
                        backlogItems,
                        targetId
                );

                if (existingItem == null) {
                    throw new IllegalStateException(
                            "Backlog item not found: " + targetId
                    );
                }

                ObjectNode targetItem = existingItem;

                updateItem.fields().forEachRemaining(entry -> {
                    if (!"id".equals(entry.getKey())) {
                        targetItem.set(
                                entry.getKey(),
                                entry.getValue().deepCopy()
                        );
                    }
                });
            }
        }

        // 6. REMOVE
        JsonNode removeItems = backlogChanges.path("remove");

        if (removeItems.isArray()) {
            for (JsonNode removeItem : removeItems) {

                // REMOVE object must contain only ID
                if (removeItem.isObject()) {
                    if (removeItem.size() != 1 || !removeItem.has("id")) {
                        throw new IllegalStateException(
                                "Remove backlog item must contain only the ID"
                        );
                    }
                }

                JsonNode idNode = removeItem.isObject()
                        ? removeItem.get("id")
                        : removeItem;

                if (idNode == null
                        || !idNode.isIntegralNumber()
                        || !idNode.canConvertToLong()) {
                    throw new IllegalStateException(
                            "Removed backlog item must have a valid ID"
                    );
                }

                long targetId = idNode.asLong();

                if (targetId <= 0) {
                    throw new IllegalStateException(
                            "Removed backlog item ID must be positive"
                    );
                }

                // Prevent removing an item that is also being updated
                if (updatedIds.contains(targetId)) {
                    throw new IllegalStateException(
                            "Backlog item cannot be both updated and removed: "
                                    + targetId
                    );
                }

                if (!removedIds.add(targetId)) {
                    throw new IllegalStateException(
                            "Duplicate backlog item ID in remove: " + targetId
                    );
                }

                ObjectNode existingItem = findBacklogItemById(
                        backlogItems,
                        targetId
                );

                if (existingItem == null) {
                    throw new IllegalStateException(
                            "Backlog item not found for removal: " + targetId
                    );
                }

                int index = -1;

                for (int i = 0; i < backlogItems.size(); i++) {
                    if (backlogItems.get(i) == existingItem) {
                        index = i;
                        break;
                    }
                }

                if (index == -1) {
                    throw new IllegalStateException(
                            "Backlog item not found for removal: " + targetId
                    );
                }

                backlogItems.remove(index);
            }
        }
    }


    private void validateBacklogItemFields(JsonNode item) {
        Set<String> allowedFields = Set.of(
                "id",
                "title",
                "description",
                "suggestedRole"
        );

        // 1. Validate allowed fields
        item.fieldNames().forEachRemaining(field -> {
            if (!allowedFields.contains(field)) {
                throw new IllegalStateException(
                        "AI is not allowed to modify backlog item field: " + field
                );
            }
        });

        // 2. Validate title
        JsonNode titleNode = item.get("title");

        if (titleNode != null && !titleNode.isNull()) {
            if (!titleNode.isTextual() || titleNode.asText().isBlank()) {
                throw new IllegalStateException(
                        "Backlog item title must be a non-blank string"
                );
            }

            if (titleNode.asText().length() > 100) {
                throw new IllegalStateException(
                        "Backlog item title must not exceed 100 characters"
                );
            }
        } else if (titleNode != null) {
            throw new IllegalStateException(
                    "Backlog item title must not be null"
            );
        }

        // 3. Validate description
        JsonNode descriptionNode = item.get("description");

        if (descriptionNode != null) {
            if (!descriptionNode.isTextual()) {
                throw new IllegalStateException(
                        "Backlog item description must be a string"
                );
            }
        }

        // 4. Validate suggestedRole
        JsonNode suggestedRoleNode = item.get("suggestedRole");

        if (suggestedRoleNode != null && !suggestedRoleNode.isNull()) {
            if (!suggestedRoleNode.isTextual()
                    || !ProjectMemberRole.isValid(suggestedRoleNode.asText())) {
                throw new IllegalStateException(
                        "Backlog item suggestedRole must be one of: PM, BA, DEV, QA"
                );
            }
        } else if (suggestedRoleNode != null) {
            throw new IllegalStateException(
                    "Backlog item suggestedRole must not be null"
            );
        }
    }

    private ObjectNode findBacklogItemById(
            ArrayNode backlogItems,
            Long targetId
    ) {
        if (targetId == null || targetId <= 0) {
            throw new IllegalStateException(
                    "Target backlog item ID must be positive"
            );
        }

        ObjectNode foundItem = null;
        Set<Long> existingIds = new HashSet<>();

        for (JsonNode item : backlogItems) {
            if (!item.isObject()) {
                throw new IllegalStateException(
                        "Template backlog item must be an object"
                );
            }

            JsonNode idNode = item.get("id");

            // ADD item without ID is allowed
            if (idNode == null || idNode.isNull()) {
                continue;
            }

            if (!idNode.isIntegralNumber()
                    || !idNode.canConvertToLong()
                    || idNode.asLong() <= 0) {
                throw new IllegalStateException(
                        "Template backlog item has an invalid ID"
                );
            }

            long currentId = idNode.asLong();

            if (!existingIds.add(currentId)) {
                throw new IllegalStateException(
                        "Duplicate backlog item ID in template: " + currentId
                );
            }

            if (currentId == targetId) {
                foundItem = (ObjectNode) item;
            }
        }

        return foundItem;
    }


    private boolean applyChanges(
            ObjectNode content,
            JsonNode changes,
            AIReviewFinding finding,
            ResolvedReviewFindingTarget target
    ) {
        if (changes == null || !changes.isObject()) {
            throw new IllegalStateException(
                    "Suggestion changes must be a JSON object"
            );
        }

        if (changes.isEmpty()) {
            throw new IllegalStateException(
                    "Suggestion changes must not be empty"
            );
        }

        if (changes.size() != 1) {
            throw new IllegalStateException(
                    "Suggestion must contain exactly one top-level section"
            );
        }

        String section = changes.fieldNames().next();
        String before = content.toString();

        switch (section) {
            case "overview" -> applyOverviewChanges(content, changes.path("overview"));
            case "teamConstraints" -> applyTeamConstraintChanges(content, changes.path("teamConstraints"), target);
            case "milestone" -> applyMilestoneChanges(content, changes.path("milestone"), finding.getTargetId());
            case "backlogItems" -> applyBacklogItemChanges(content, changes);
            case "rubric", "resources" -> {
                return false;
            }

            case "modules" ->
                    throw new IllegalStateException(
                            "AI suggestion is not allowed to modify modules"
                    );

            default ->
                    throw new IllegalStateException(
                            "Unsupported suggestion section: " + section
                    );
        }
        return !before.equals(content.toString());
    }

    private AIReviewSuggestionApplyResponse invalidate(AIReviewSuggestion suggestion, String reason) {
        suggestionService.invalidate(suggestion, reason);
        return new AIReviewSuggestionApplyResponse(suggestionService.toResponse(suggestion), null);
    }

    private ReviewFindingInput toInput(AIReviewFinding finding) {
        return new ReviewFindingInput(finding.getCategory(), finding.getSeverity(), finding.getTitle(),
                finding.getDescription(), finding.getRecommendation(), finding.getTargetType(), finding.getTargetId());
    }

    private boolean isLatestReusable(Long templateId, Long snapshotId) {
        return snapshotRepository.findByTemplateIdOrderByCreatedAtDesc(templateId).stream()
                .filter(version -> version.getProjectId() == null
                        && Boolean.TRUE.equals(version.getIsActive())
                        && versionConfigurations.isReusableVersion(version))
                .findFirst()
                .map(version -> version.getId().equals(snapshotId))
                .orElse(false);
    }

    private void lockTemplateVersions(Long... templateIds) {
        Set<Long> orderedIds = new java.util.TreeSet<>(List.of(templateIds));
        for (Long templateId : orderedIds) {
            ProjectTemplate owner = templateRepository.findById(templateId)
                    .orElseThrow(() -> new EntityNotFoundException("Project template was not found"));
            templateRepository.findForTemplateUpdate(templateId, owner.getTenantId())
                    .orElseThrow(() -> new EntityNotFoundException("Project template was not found"));
        }
    }

    private JsonNode readJson(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Stored review suggestion JSON is invalid", exception);
        }
    }

    private ObjectNode readContent(String value) {
        JsonNode node = readJson(value);
        if (!(node instanceof ObjectNode object)) {
            throw new IllegalStateException("Template snapshot content must be a JSON object");
        }
        return object;
    }

    private void applyOverviewChanges(ObjectNode content, JsonNode updates) {
        updates.fields().forEachRemaining(entry ->
                content.set(entry.getKey(), entry.getValue().deepCopy()));
    }

    private void applyTeamConstraintChanges(
            ObjectNode content,
            JsonNode updates,
            ResolvedReviewFindingTarget target
    ) {
        TemplateTeamConstraints current = teamConstraintsMapper.read(content.path("constraints").toString());
        if (current == null) {
            throw new IllegalStateException("The snapshot has no complete team constraints to update");
        }
        JsonNode quotas = updates.path("roleQuotas");
        TemplateTeamConstraints.RoleQuotas currentQuotas = current.roleQuotas();
        TemplateTeamConstraintsRequest request = new TemplateTeamConstraintsRequest(
                updateNumber(updates, "minMembers", current.minMembers()),
                updateNumber(updates, "maxMembers", current.maxMembers()),
                new TemplateTeamConstraintsRequest.RoleQuotas(
                        updateQuota(quotas, "pm", currentQuotas.pm()),
                        updateQuota(quotas, "ba", currentQuotas.ba()),
                        updateQuota(quotas, "dev", currentQuotas.dev()),
                        updateQuota(quotas, "qa", currentQuotas.qa())),
                updates.has("allowMultiRole")
                        ? updates.path("allowMultiRole").booleanValue()
                        : current.allowMultiRole(),
                BigDecimal.valueOf(snapshotOwnerLockVersion(target.snapshotId())));

        if (request.minMembers().intValueExact() == current.minMembers()
                && request.maxMembers().intValueExact() == current.maxMembers()
                && request.roleQuotas().pm().intValueExact() == currentQuotas.pm()
                && request.roleQuotas().ba().intValueExact() == currentQuotas.ba()
                && request.roleQuotas().dev().intValueExact() == currentQuotas.dev()
                && request.roleQuotas().qa().intValueExact() == currentQuotas.qa()
                && request.allowMultiRole() == current.allowMultiRole()) {
            return;
        }
        content.set("constraints", readJson(teamConstraintsMapper.write(
                content.path("constraints").toString(), request)));
    }

    private BigDecimal updateNumber(JsonNode updates, String field, int currentValue) {
        JsonNode value = updates.get(field);
        return value == null ? BigDecimal.valueOf(currentValue) : value.decimalValue();
    }

    private BigDecimal updateQuota(JsonNode updates, String field, int currentValue) {
        JsonNode value = updates.get(field);
        return value == null ? BigDecimal.valueOf(currentValue) : value.decimalValue();
    }

    private void applyMilestoneChanges(ObjectNode content, JsonNode changes, String targetId) {
        JsonNode milestonesNode = content.path("milestones");
        if (!(milestonesNode instanceof ArrayNode milestones)) {
            throw new IllegalStateException("Template milestones must be an array");
        }
        ObjectNode target = findById(milestones, targetId, "milestone");

        if (changes.has("details")) {
            changes.path("details").fields().forEachRemaining(entry ->
                    target.set(entry.getKey(), entry.getValue().deepCopy()));
        }
        if (changes.has("latePolicy")) {
            JsonNode policyNode = target.path("latePolicy");
            ObjectNode policy = policyNode instanceof ObjectNode object
                    ? object
                    : objectMapper.createObjectNode();
            changes.path("latePolicy").fields().forEachRemaining(entry ->
                    policy.set(entry.getKey(), entry.getValue().deepCopy()));
            target.set("latePolicy", policy);
        }
        if (changes.has("checklistItems")) {
            JsonNode itemsNode = target.path("checklistItems");
            if (!(itemsNode instanceof ArrayNode items)) {
                throw new IllegalStateException("Milestone checklistItems must be an array");
            }
            JsonNode operations = changes.path("checklistItems");
            JsonNode additions = operations.path("add");
            if (additions.isArray()) {
                for (JsonNode item : additions) items.add(item.deepCopy());
            }
            JsonNode updates = operations.path("update");
            if (updates.isArray()) {
                for (JsonNode item : updates) {
                    ObjectNode existing = findById(items, item.path("id").asText(), "checklist item");
                    item.fields().forEachRemaining(entry -> {
                        if (!"id".equals(entry.getKey())) {
                            existing.set(entry.getKey(), entry.getValue().deepCopy());
                        }
                    });
                }
            }
            JsonNode removals = operations.path("remove");
            if (removals.isArray()) {
                for (JsonNode item : removals) {
                    String id = removalId(item);
                    int index = indexById(items, id);
                    if (index < 0) throw new IllegalStateException("Checklist item not found: " + id);
                    items.remove(index);
                }
            }
        }
    }

    private ObjectNode findById(ArrayNode items, String id, String label) {
        for (JsonNode item : items) {
            if (item.isObject() && item.path("id").asText().equals(id)) {
                return (ObjectNode) item;
            }
        }
        throw new IllegalStateException(label + " not found: " + id);
    }

    private int indexById(ArrayNode items, String id) {
        for (int index = 0; index < items.size(); index++) {
            if (items.get(index).path("id").asText().equals(id)) return index;
        }
        return -1;
    }

    private String removalId(JsonNode item) {
        if (item.isObject() && item.size() == 1) return item.path("id").asText();
        if (item.isValueNode()) return item.asText();
        throw new IllegalStateException("Remove operation must contain only an ID");
    }

    private void persistConfigurationChange(
            Long snapshotId,
            ObjectNode content,
            JsonNode changes
    ) {
        String section = changes.fieldNames().next();
        BigDecimal lockVersion = BigDecimal.valueOf(snapshotOwnerLockVersion(snapshotId));

        switch (section) {
            case "overview" -> {
                ProjectTemplate owner = templateForSnapshot(snapshotId);
                ProjectTemplateRequest request = new ProjectTemplateRequest(
                        content.path("code").asText(owner.getCode()),
                        content.path("name").asText(owner.getName()),
                        textOrNull(content, "description"),
                        textOrNull(content, "category"),
                        textOrNull(content, "level"),
                        decimalOrNull(content, "estimatedDurationWeeks"),
                        lockVersion,
                        owner.getParentTemplateId(),
                        textOrNull(content, "technologyStack"));
                versionConfigurations.saveOverview(snapshotId, request);
            }
            case "teamConstraints" -> versionConfigurations.saveTeam(
                    snapshotId, teamRequest(content.path("constraints"), lockVersion));
            case "milestone", "rubric" -> versionConfigurations.saveMilestones(
                    snapshotId, milestonePlan(content.path("milestones"), lockVersion));
            case "backlogItems" -> versionConfigurations.saveBacklog(
                    snapshotId, backlogRequest(content.path("backlogItems"), lockVersion));
            default -> throw new IllegalStateException("Unsupported suggestion section: " + section);
        }
    }

    private long snapshotOwnerLockVersion(Long snapshotId) {
        return templateForSnapshot(snapshotId).getLockVersion();
    }

    private ProjectTemplate templateForSnapshot(Long snapshotId) {
        ProjectTemplateSnapshot snapshot = snapshotRepository.findById(snapshotId)
                .orElseThrow(() -> new EntityNotFoundException("Template snapshot was not found"));
        return templateRepository.findById(snapshot.getTemplateId())
                .orElseThrow(() -> new EntityNotFoundException("Project template was not found"));
    }

    private String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private BigDecimal decimalOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isNumber() ? null : value.decimalValue();
    }

    private TemplateTeamConstraintsRequest teamRequest(JsonNode constraints, BigDecimal revision) {
        TemplateTeamConstraints value = teamConstraintsMapper.read(constraints.toString());
        if (value == null) throw new IllegalStateException("Snapshot team constraints are incomplete");
        return new TemplateTeamConstraintsRequest(
                BigDecimal.valueOf(value.minMembers()),
                BigDecimal.valueOf(value.maxMembers()),
                new TemplateTeamConstraintsRequest.RoleQuotas(
                        BigDecimal.valueOf(value.roleQuotas().pm()),
                        BigDecimal.valueOf(value.roleQuotas().ba()),
                        BigDecimal.valueOf(value.roleQuotas().dev()),
                        BigDecimal.valueOf(value.roleQuotas().qa())),
                value.allowMultiRole(),
                revision);
    }

    private TemplateMilestonePlanRequest milestonePlan(JsonNode values, BigDecimal revision) {
        if (!values.isArray()) throw new IllegalStateException("Template milestones must be an array");
        List<TemplateMilestonePlanRequest.Milestone> milestones = new ArrayList<>();
        for (JsonNode item : values) {
            List<TemplateMilestonePlanRequest.ChecklistItem> checklist = new ArrayList<>();
            JsonNode checks = item.path("checklistItems");
            if (checks.isArray()) {
                for (JsonNode check : checks) {
                    checklist.add(new TemplateMilestonePlanRequest.ChecklistItem(
                            decimalOrNull(check, "id"),
                            textOrNull(check, "content"),
                            booleanOrNull(check, "mandatory")));
                }
            }
            JsonNode late = item.path("latePolicy");
            TemplateMilestonePlanRequest.LatePolicy latePolicy = late.isObject()
                    ? new TemplateMilestonePlanRequest.LatePolicy(
                            booleanOrNull(late, "allowLateSubmission"),
                            decimalOrNull(late, "maxLateDays"),
                            decimalOrNull(late, "penaltyPerDayPercent"))
                    : null;
            milestones.add(new TemplateMilestonePlanRequest.Milestone(
                    decimalOrNull(item, "id"),
                    textOrNull(item, "title"),
                    textOrNull(item, "description"),
                    decimalOrNull(item, "dueAfter"),
                    enumOrNull(item, "dueUnit", TemplateMilestoneTimeUnit.class),
                    decimalOrNull(item, "weight"),
                    booleanOrNull(item, "mandatory"),
                    uuidOrNull(item, "rubricVersionId"),
                    checklist,
                    latePolicy));
        }
        return new TemplateMilestonePlanRequest(revision, milestones);
    }

    private TemplateSampleContentRequest backlogRequest(JsonNode values, BigDecimal revision) {
        if (!values.isArray()) throw new IllegalStateException("Template backlogItems must be an array");
        List<TemplateSampleContentRequest.BacklogItem> items = new ArrayList<>();
        for (JsonNode item : values) {
            items.add(new TemplateSampleContentRequest.BacklogItem(
                    decimalOrNull(item, "id"),
                    textOrNull(item, "title"),
                    textOrNull(item, "description"),
                    enumOrNull(item, "suggestedRole", ProjectMemberRole.class)));
        }
        return new TemplateSampleContentRequest(revision, items);
    }

    private Boolean booleanOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || !value.isBoolean() ? null : value.booleanValue();
    }

    private <T extends Enum<T>> T enumOrNull(JsonNode node, String field, Class<T> type) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual()) return null;
        try {
            return Enum.valueOf(type, value.asText());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private UUID uuidOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual()) return null;
        try {
            return UUID.fromString(value.asText());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private boolean requiresRubricVersion(JsonNode changes) {
        return changes.path("rubric").has("criteria")
                || changes.path("milestone").path("rubric").has("criteria");
    }

    private JsonNode criterionChanges(JsonNode changes) {
        return changes.has("rubric")
                ? changes.path("rubric").path("criteria")
                : changes.path("milestone").path("rubric").path("criteria");
    }

    private RubricVersion sourceRubricVersion(
            JsonNode changes,
            AIReviewFinding finding,
            ResolvedReviewFindingTarget target,
            Long tenantId
    ) {
        String versionId;
        if (changes.has("rubric")) {
            versionId = finding.getTargetId();
        } else {
            Object resolved = target.target();
            if (!(resolved instanceof JsonNode milestone)
                    || !milestone.hasNonNull("rubricVersionId")) {
                throw new IllegalStateException("Milestone does not reference a rubric version");
            }
            versionId = milestone.path("rubricVersionId").asText();
        }
        UUID id;
        try {
            id = UUID.fromString(versionId);
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("The finding references an invalid rubric version", exception);
        }
        RubricVersion version = rubricCatalog.findByIdForTenant(id, tenantId)
                .orElseThrow(() -> new EntityNotFoundException("Rubric version was not found"));
        if (version.getStatus() != RubricVersionStatus.PUBLISHED) {
            throw new IllegalStateException("Only a published rubric version can be updated by a suggestion");
        }
        return version;
    }

    private boolean rubricWouldChange(RubricVersion source, JsonNode operations) {
        return !sameCriteria(source, updatedRubricCriteria(source, operations));
    }

    private boolean sameCriteria(RubricVersion source, List<RubricCriterionRequest> proposed) {
        if (source.getCriteria().size() != proposed.size()) return false;
        List<?> existing = source.getCriteria().stream()
                .sorted(Comparator.comparingInt(item -> item.getOrderIndex()))
                .toList();
        List<RubricCriterionRequest> ordered = proposed.stream()
                .sorted(Comparator.comparingInt(RubricCriterionRequest::orderIndex))
                .toList();
        for (int index = 0; index < ordered.size(); index++) {
            var old = (com.example.starter_project_2025.system.project.rubric.domain.RubricCriterion) existing.get(index);
            RubricCriterionRequest next = ordered.get(index);
            if (!old.getCode().equals(next.code())
                    || !old.getName().equals(next.name())
                    || !java.util.Objects.equals(old.getDescription(), next.description())
                    || old.getWeight().compareTo(next.weight()) != 0
                    || old.getMaxScore().compareTo(next.maxScore()) != 0
                    || old.getOrderIndex() != next.orderIndex()
                    || !sameRatings(old, next)) {
                return false;
            }
        }
        return true;
    }

    private boolean sameRatings(
            com.example.starter_project_2025.system.project.rubric.domain.RubricCriterion existing,
            RubricCriterionRequest proposed
    ) {
        if (existing.getRatings().size() != proposed.ratings().size()) return false;
        for (RubricRatingRequest rating : proposed.ratings()) {
            var match = existing.getRatings().stream()
                    .filter(value -> value.getLevel() == rating.level())
                    .findFirst()
                    .orElse(null);
            if (match == null || !java.util.Objects.equals(match.getDescription(), rating.description())) {
                return false;
            }
        }
        return true;
    }

    private List<RubricCriterionRequest> updatedRubricCriteria(
            RubricVersion source,
            JsonNode operations
    ) {
        Map<UUID, RubricCriterionRequest> criteria = new LinkedHashMap<>();
        for (var item : source.getCriteria()) {
            List<RubricRatingRequest> ratings = item.getRatings().stream()
                    .map(rating -> new RubricRatingRequest(rating.getLevel(), rating.getDescription()))
                    .toList();
            criteria.put(item.getId(), new RubricCriterionRequest(item.getCode(), item.getName(),
                    item.getDescription(), item.getWeight(), item.getMaxScore(), item.getOrderIndex(), ratings));
        }

        JsonNode additions = operations.path("add");
        if (additions.isArray()) {
            for (JsonNode item : additions) criteria.put(UUID.randomUUID(), rubricCriterion(item));
        }
        JsonNode updates = operations.path("update");
        if (updates.isArray()) {
            for (JsonNode item : updates) {
                UUID id = UUID.fromString(item.path("id").asText());
                if (!criteria.containsKey(id)) {
                    throw new IllegalStateException("Rubric criterion does not belong to the source version: " + id);
                }
                criteria.put(id, rubricCriterion(item));
            }
        }
        JsonNode removals = operations.path("remove");
        if (removals.isArray()) {
            for (JsonNode item : removals) {
                UUID id = UUID.fromString(removalId(item));
                if (criteria.remove(id) == null) {
                    throw new IllegalStateException("Rubric criterion does not belong to the source version: " + id);
                }
            }
        }
        return criteria.values().stream()
                .sorted(Comparator.comparingInt(RubricCriterionRequest::orderIndex))
                .toList();
    }

    private RubricCriterionRequest rubricCriterion(JsonNode item) {
        List<RubricRatingRequest> ratings = new ArrayList<>();
        for (JsonNode rating : item.path("ratings")) {
            ratings.add(new RubricRatingRequest(
                    RubricRatingLevel.valueOf(rating.path("level").asText()),
                    textOrNull(rating, "description")));
        }
        return new RubricCriterionRequest(
                item.path("code").asText(),
                item.path("name").asText(),
                textOrNull(item, "description"),
                decimalOrNull(item, "weight"),
                decimalOrNull(item, "maxScore"),
                item.path("orderIndex").asInt(),
                ratings);
    }

    private UUID createRubricVersion(
            RubricVersion source,
            JsonNode operations
    ) {
        var created = rubricService.createVersion(source.getRubric().getId(),
                new CreateRubricVersionRequest(source.getId()));
        var draft = created.versions().stream()
                .filter(version -> version.status() == RubricVersionStatus.DRAFT)
                .max(Comparator.comparingInt(
                        com.example.starter_project_2025.system.project.rubric.dto.RubricVersionResponse::versionNumber))
                .orElseThrow(() -> new IllegalStateException("A new draft rubric version was not created"));
        SaveRubricDraftRequest request = new SaveRubricDraftRequest(
                source.getNameSnapshot(),
                source.getDescriptionSnapshot(),
                updatedRubricCriteria(source, operations));
        rubricService.updateDraft(source.getRubric().getId(), draft.id(), request);
        rubricService.publish(source.getRubric().getId(), draft.id());
        return draft.id();
    }

    private void updateRubricReferences(
            ObjectNode content,
            AIReviewFinding finding,
            UUID newVersionId
    ) {
        JsonNode milestonesNode = content.path("milestones");
        if (!(milestonesNode instanceof ArrayNode milestones)) {
            throw new IllegalStateException("Template milestones must be an array");
        }
        String oldVersionId;
        boolean oneMilestone = finding.getCategory()
                == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.MILESTONE;
        if (oneMilestone) {
            ObjectNode milestone = findById(milestones, finding.getTargetId(), "milestone");
            oldVersionId = milestone.path("rubricVersionId").asText();
            if (!oldVersionId.isBlank()) milestone.put("rubricVersionId", newVersionId.toString());
            else throw new IllegalStateException("Milestone does not reference a rubric version");
        } else {
            oldVersionId = finding.getTargetId();
            int replaced = 0;
            for (JsonNode value : milestones) {
                if (value instanceof ObjectNode milestone
                        && oldVersionId.equals(milestone.path("rubricVersionId").asText())) {
                    milestone.put("rubricVersionId", newVersionId.toString());
                    replaced++;
                }
            }
            if (replaced == 0) {
                throw new IllegalStateException("Rubric version is not referenced by this snapshot");
            }
        }
    }

    private boolean resourcesWillChange(Long sourceVersionId, JsonNode operations) {
        List<ResourceState> before = resourceVersions.getByVersion(sourceVersionId).items().stream()
                .map(ResourceState::from)
                .toList();
        List<ResourceState> after = new ArrayList<>(before);

        JsonNode additions = operations.path("add");
        if (additions.isArray()) {
            for (JsonNode item : additions) {
                after.add(new ResourceState(null, textOrNull(item, "title"), textOrNull(item, "description"),
                        resourceKind(item), textOrNull(item, "url"),
                        item.hasNonNull("orderIndex") ? item.path("orderIndex").asInt() : after.size()));
            }
        }
        JsonNode updates = operations.path("update");
        if (updates.isArray()) {
            for (JsonNode item : updates) {
                long id = item.path("id").asLong();
                int index = resourceIndex(after, id);
                if (index < 0) throw new IllegalStateException("Resource not found: " + id);
                ResourceState old = after.get(index);
                after.set(index, new ResourceState(old.id(),
                        item.has("title") ? textOrNull(item, "title") : old.title(),
                        item.has("description") ? textOrNull(item, "description") : old.description(),
                        item.has("kind") ? resourceKind(item) : old.kind(),
                        item.has("url") ? textOrNull(item, "url") : old.url(),
                        item.has("orderIndex") ? item.path("orderIndex").asInt() : old.orderIndex()));
            }
        }
        JsonNode removals = operations.path("remove");
        if (removals.isArray()) {
            for (JsonNode item : removals) {
                long id = Long.parseLong(removalId(item));
                int index = resourceIndex(after, id);
                if (index < 0) throw new IllegalStateException("Resource not found: " + id);
                after.remove(index);
            }
        }
        return !before.equals(after);
    }

    private void applyResourceChanges(Long sourceVersionId, Long targetVersionId, JsonNode operations) {
        List<TemplateResourceView> source = resourceVersions.getByVersion(sourceVersionId).items();
        List<TemplateResourceView> copies = resourceVersions.getByVersion(targetVersionId).items();
        if (source.size() != copies.size()) {
            throw new IllegalStateException("Copied resource list does not match the source snapshot");
        }
        Map<Long, Long> copiedIds = new HashMap<>();
        for (int index = 0; index < source.size(); index++) {
            if (!sameResourceContent(source.get(index), copies.get(index))) {
                throw new IllegalStateException("Copied resource ordering does not match the source snapshot");
            }
            copiedIds.put(source.get(index).id(), copies.get(index).id());
        }

        JsonNode additions = operations.path("add");
        if (additions.isArray()) {
            for (JsonNode item : additions) {
                resourceVersions.create(targetVersionId, resourceRequest(
                        textOrNull(item, "title"), textOrNull(item, "description"),
                        resourceKind(item), textOrNull(item, "url"),
                        item.hasNonNull("orderIndex") ? item.path("orderIndex").asInt() : null));
            }
        }
        JsonNode updates = operations.path("update");
        if (updates.isArray()) {
            for (JsonNode item : updates) {
                long sourceId = item.path("id").asLong();
                TemplateResourceView old = source.stream()
                        .filter(value -> value.id().equals(sourceId))
                        .findFirst()
                        .orElseThrow(() -> new IllegalStateException("Resource not found: " + sourceId));
                Long copiedId = copiedIds.get(sourceId);
                if (copiedId == null) throw new IllegalStateException("Copied resource target is missing");
                resourceVersions.update(targetVersionId, copiedId, resourceRequest(
                        item.has("title") ? textOrNull(item, "title") : old.title(),
                        item.has("description") ? textOrNull(item, "description") : old.description(),
                        item.has("kind") ? resourceKind(item) : old.kind(),
                        item.has("url") ? textOrNull(item, "url") : old.url(),
                        item.has("orderIndex") ? item.path("orderIndex").asInt() : old.orderIndex()));
            }
        }
        JsonNode removals = operations.path("remove");
        if (removals.isArray()) {
            for (JsonNode item : removals) {
                long sourceId = Long.parseLong(removalId(item));
                Long copiedId = copiedIds.get(sourceId);
                if (copiedId == null) throw new IllegalStateException("Copied resource target is missing");
                resourceVersions.delete(targetVersionId, copiedId);
            }
        }
    }

    private TemplateResourceRequest resourceRequest(
            String title,
            String description,
            ResourceKind kind,
            String url,
            Integer orderIndex
    ) {
        return new TemplateResourceRequest(title, description, kind, url, orderIndex);
    }

    private ResourceKind resourceKind(JsonNode item) {
        return ResourceKind.valueOf(item.path("kind").asText());
    }

    private int resourceIndex(List<ResourceState> resources, long id) {
        for (int index = 0; index < resources.size(); index++) {
            if (resources.get(index).id() != null && resources.get(index).id() == id) return index;
        }
        return -1;
    }

    private boolean sameResourceContent(TemplateResourceView left, TemplateResourceView right) {
        return java.util.Objects.equals(left.title(), right.title())
                && java.util.Objects.equals(left.description(), right.description())
                && left.kind() == right.kind()
                && java.util.Objects.equals(left.url(), right.url())
                && java.util.Objects.equals(left.orderIndex(), right.orderIndex());
    }

    private record ResourceState(
            Long id,
            String title,
            String description,
            ResourceKind kind,
            String url,
            Integer orderIndex
    ) {
        private static ResourceState from(TemplateResourceView view) {
            return new ResourceState(view.id(), view.title(), view.description(), view.kind(),
                    view.url(), view.orderIndex());
        }
    }

}