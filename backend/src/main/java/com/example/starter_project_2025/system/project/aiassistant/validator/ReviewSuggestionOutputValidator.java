package com.example.starter_project_2025.system.project.aiassistant.validator;

import com.example.starter_project_2025.system.project.aiassistant.dto.ResolvedReviewFindingTarget;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewResourceContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewRubricContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewRubricCriterionContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewTemplateNode;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.ReviewFindingInput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.ReviewSuggestionOutput;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;

@Component
public class ReviewSuggestionOutputValidator {

    private static final Set<String> FORBIDDEN_FIELDS = Set.of(
            "templateId", "snapshotId", "tenantId", "templateVersion", "version",
            "status", "lockVersion", "createdAt", "updatedAt", "createdBy", "updatedBy",
            "rubricVersionId");

    public List<String> validate(
            ReviewSuggestionOutput output,
            ReviewFindingInput finding,
            ResolvedReviewFindingTarget resolvedTarget
    ) {
        List<String> errors = new ArrayList<>();
        if (output == null) return List.of("Suggestion output is required");
        if (finding == null) return List.of("Review finding is required");
        if (resolvedTarget == null) return List.of("Resolved finding target is required");
        if (output.rationale() == null || output.rationale().isBlank()) {
            errors.add("Rationale must not be blank");
        }
        JsonNode changes = output.changes();
        if (changes == null || !changes.isObject()) {
            errors.add("Changes must be a JSON object");
            return errors;
        }
        if (changes.isEmpty()) {
            errors.add("Changes must contain at least one section");
            return errors;
        }
        validateTopLevelSection(changes, finding, errors);
        validateSystemManagedFields(changes, errors);
        if (changes.isEmpty()) return errors;

        String sectionName = changes.fieldNames().next();
        JsonNode section = changes.get(sectionName);
        switch (finding.category()) {
            case PROJECT_TEMPLATE, MODULE ->
                    validateTemplateChanges(sectionName, section, finding.category(), resolvedTarget, errors);
            case MILESTONE -> validateMilestoneChanges(section, resolvedTarget, errors);
            case BACKLOG -> validateBacklogChanges(section, finding, resolvedTarget, errors);
            case RUBRIC -> validateRubricChanges(section, resolvedTarget, errors);
            case DOCUMENT -> validateResourceChanges(section, finding, resolvedTarget, errors);
        }
        return errors;
    }

    private void validateTopLevelSection(
            JsonNode changes,
            ReviewFindingInput finding,
            List<String> errors
    ) {
        if (changes.isEmpty()) return;
        if (changes.size() != 1) {
            errors.add("Changes must contain exactly one top-level section");
            return;
        }
        String section = changes.fieldNames().next();
        Set<String> allowed = switch (finding.category()) {
            case PROJECT_TEMPLATE, MODULE -> Set.of("overview", "teamConstraints");
            case MILESTONE -> Set.of("milestone");
            case BACKLOG -> Set.of("backlogItems");
            case RUBRIC -> Set.of("rubric");
            case DOCUMENT -> Set.of("resources");
        };
        if (!allowed.contains(section)) {
            errors.add("Section '" + section + "' is not allowed for category " + finding.category());
        }
    }

    private void validateSystemManagedFields(JsonNode node, List<String> errors) {
        if (node == null || node.isValueNode()) return;
        if (node.isObject()) {
            node.fields().forEachRemaining(entry -> {
                if (FORBIDDEN_FIELDS.contains(entry.getKey())) {
                    errors.add("System-managed field is not allowed: " + entry.getKey());
                }
                validateSystemManagedFields(entry.getValue(), errors);
            });
        } else if (node.isArray()) {
            for (JsonNode value : node) validateSystemManagedFields(value, errors);
        }
    }

    private void validateTemplateChanges(
            String sectionName,
            JsonNode section,
            AIReviewFindingCategory category,
            ResolvedReviewFindingTarget target,
            List<String> errors
    ) {
        if (section == null || !section.isObject()) {
            errors.add("Template change section must be a JSON object");
            return;
        }
        if (section.isEmpty()) {
            errors.add("Template change section must contain at least one field");
            return;
        }
        if ("overview".equals(sectionName)) {
            Set<String> fields = category == AIReviewFindingCategory.MODULE
                    ? Set.of("name", "description", "technologyStack", "level", "estimatedDurationWeeks")
                    : Set.of("name", "description", "technologyStack", "category", "level", "estimatedDurationWeeks");
            validateAllowedFields(section, fields, "overview", errors);
            validateOptionalText(section, "name", 100, errors);
            validateOptionalText(section, "description", 1000, errors);
            validateOptionalText(section, "technologyStack", 2000, errors);
            validateOptionalText(section, "category", 255, errors);
            validateOptionalText(section, "level", 20, errors);
            validateOptionalPositiveInteger(section, "estimatedDurationWeeks", errors);
            return;
        }
        if (!"teamConstraints".equals(sectionName)) {
            errors.add("Unsupported template suggestion section: " + sectionName);
            return;
        }
        validateAllowedFields(section,
                Set.of("minMembers", "maxMembers", "roleQuotas", "allowMultiRole"),
                "teamConstraints", errors);
        validateTeamConstraints(section, currentConstraints(target), errors);
    }

    private JsonNode currentConstraints(ResolvedReviewFindingTarget target) {
        if (target.target() instanceof ReviewContext context) return context.constraints();
        if (target.target() instanceof ReviewTemplateNode module) return module.constraints();
        return null;
    }

    private void validateTeamConstraints(JsonNode updates, JsonNode current, List<String> errors) {
        if (updates.isEmpty()) {
            errors.add("teamConstraints must contain at least one field");
            return;
        }
        validateOptionalPositiveInteger(updates, "minMembers", errors);
        validateOptionalPositiveInteger(updates, "maxMembers", errors);
        JsonNode multiRole = updates.get("allowMultiRole");
        if (multiRole != null && !multiRole.isBoolean()) errors.add("allowMultiRole must be a boolean");
        JsonNode quotas = updates.get("roleQuotas");
        if (quotas != null) {
            validateAllowedFields(quotas, Set.of("pm", "ba", "dev", "qa"), "roleQuotas", errors);
            for (String role : List.of("pm", "ba", "dev", "qa")) {
                validateOptionalNonNegativeInteger(quotas, role, errors);
            }
        }
        BigDecimal min = effectiveNumber(updates, "minMembers", current, "min_members");
        BigDecimal max = effectiveNumber(updates, "maxMembers", current, "max_members");
        if (min != null && max != null && min.compareTo(max) > 0) {
            errors.add("minMembers must not exceed maxMembers");
        }
        if (max == null) return;
        BigDecimal total = BigDecimal.ZERO;
        for (String role : List.of("pm", "ba", "dev", "qa")) {
            BigDecimal quota = effectiveQuota(updates, role, current);
            if (quota != null) total = total.add(quota);
        }
        if (total.compareTo(max) > 0) errors.add("Total role quotas must not exceed maxMembers");
    }

    private BigDecimal effectiveNumber(JsonNode updates, String key, JsonNode current, String currentKey) {
        JsonNode value = updates.get(key);
        if (value != null) return value.isNumber() ? value.decimalValue() : null;
        value = current == null ? null : current.get(currentKey);
        return value != null && value.isNumber() ? value.decimalValue() : null;
    }

    private BigDecimal effectiveQuota(JsonNode updates, String role, JsonNode current) {
        JsonNode quotas = updates.get("roleQuotas");
        JsonNode value = quotas == null ? null : quotas.get(role);
        if (value == null && current != null) {
            quotas = current.path("role_quotas");
            value = quotas.has(role) ? quotas.get(role) : quotas.get(role.toUpperCase(java.util.Locale.ROOT));
        }
        if (value != null && value.isObject()) value = value.get("min");
        return value != null && value.isNumber() ? value.decimalValue() : null;
    }

    private void validateMilestoneChanges(
            JsonNode section,
            ResolvedReviewFindingTarget resolved,
            List<String> errors
    ) {
        if (section.isEmpty()) errors.add("milestone must contain at least one field");
        validateAllowedFields(section, Set.of("details", "checklistItems", "latePolicy", "rubric"),
                "milestone", errors);
        JsonNode target = resolved.target() instanceof JsonNode value ? value : null;
        if (target == null) errors.add("Milestone finding target is unavailable");
        if (section.has("details")) {
            JsonNode details = section.path("details");
            validateAllowedFields(details,
                    Set.of("title", "description", "dueAfter", "dueUnit", "weight", "mandatory"),
                    "milestone.details", errors);
            validateOptionalText(details, "title", 120, errors);
            validateOptionalText(details, "description", 1000, errors);
            validateOptionalPositiveInteger(details, "dueAfter", errors);
            JsonNode unit = details.get("dueUnit");
            if (unit != null && (!unit.isTextual() || !Set.of("DAYS", "WEEKS").contains(unit.asText()))) {
                errors.add("milestone.details.dueUnit must be DAYS or WEEKS");
            }
            validateOptionalNumberRange(details, "weight", BigDecimal.ZERO, new BigDecimal("100"), true, errors);
            validateOptionalBoolean(details, "mandatory", errors);
        }
        if (section.has("latePolicy")) {
            JsonNode policy = section.path("latePolicy");
            validateAllowedFields(policy,
                    Set.of("allowLateSubmission", "maxLateDays", "penaltyPerDayPercent"),
                    "milestone.latePolicy", errors);
            validateOptionalBoolean(policy, "allowLateSubmission", errors);
            validateOptionalPositiveInteger(policy, "maxLateDays", errors);
            validateOptionalNumberRange(policy, "penaltyPerDayPercent",
                    BigDecimal.ZERO, new BigDecimal("100"), true, errors);
        }
        if (section.has("checklistItems")) {
            validateChecklistOperations(section.path("checklistItems"), target, errors);
        }
        if (section.has("rubric")) {
            JsonNode rubric = section.path("rubric");
            validateAllowedFields(rubric, Set.of("criteria"), "milestone.rubric", errors);
            validateCriterionOperations(rubric.path("criteria"),
                    target == null ? null : target.path("editableRubric"), errors);
        }
    }

    private void validateChecklistOperations(JsonNode operations, JsonNode milestone, List<String> errors) {
        if (!validateOperations(operations, "checklistItems", errors)) return;
        JsonNode existing = milestone == null ? null : milestone.path("checklistItems");
        validateAdds(operations.path("add"), Set.of("content", "mandatory"), "checklist item", errors, item -> {
            validateRequiredText(item, "content", 500, "Checklist item content", errors);
            validateRequiredBoolean(item, "mandatory", "Checklist item mandatory", errors);
        });
        validateUpdates(operations.path("update"), "checklist item", existing,
                Set.of("id", "content", "mandatory"), errors, item -> {
                    validateOptionalText(item, "content", 500, errors);
                    validateOptionalBoolean(item, "mandatory", errors);
                });
        validateRemovals(operations.path("remove"), "checklist item", existing, errors);
    }

    private void validateBacklogChanges(
            JsonNode operations,
            ReviewFindingInput finding,
            ResolvedReviewFindingTarget resolved,
            List<String> errors
    ) {
        if (!validateOperations(operations, "backlogItems", errors)) return;
        if (!(resolved.target() instanceof JsonNode)) errors.add("Backlog finding target is unavailable");
        validateAdds(operations.path("add"), Set.of("title", "description", "suggestedRole"),
                "backlog item", errors, item -> {
                    validateRequiredText(item, "title", 100, "Backlog item title", errors);
                    validateOptionalText(item, "description", 1000, errors);
                    validateRole(item, errors);
                });
        validateTargetUpdates(operations.path("update"), finding.targetId(), "backlog item",
                Set.of("id", "title", "description", "suggestedRole"), errors, item -> {
                    validateOptionalText(item, "title", 100, errors);
                    validateOptionalText(item, "description", 1000, errors);
                    validateRole(item, errors);
                });
        validateTargetRemovals(operations.path("remove"), finding.targetId(), "backlog item", errors);
    }

    private void validateRole(JsonNode item, List<String> errors) {
        JsonNode role = item.get("suggestedRole");
        if (role != null && (!role.isTextual()
                || !Set.of("PM", "BA", "DEV", "QA").contains(role.asText()))) {
            errors.add("suggestedRole must be one of PM, BA, DEV, QA");
        }
    }

    private void validateRubricChanges(
            JsonNode section,
            ResolvedReviewFindingTarget resolved,
            List<String> errors
    ) {
        validateAllowedFields(section, Set.of("criteria"), "rubric", errors);
        validateCriterionOperations(section.path("criteria"), resolved.target(), errors);
    }

    private void validateCriterionOperations(JsonNode operations, Object target, List<String> errors) {
        if (!validateOperations(operations, "criteria", errors)) return;
        JsonNode existing = target instanceof ReviewRubricContext rubric
                ? rubricCriteria(rubric)
                : target instanceof JsonNode context && context.path("criteria").isArray()
                ? context
                : null;
        validateAdds(operations.path("add"),
                Set.of("code", "name", "description", "weight", "maxScore", "orderIndex", "ratings"),
                "rubric criterion", errors, item -> validateCriterion(item, errors));
        validateUpdates(operations.path("update"), "rubric criterion", existing,
                Set.of("id", "code", "name", "description", "weight", "maxScore", "orderIndex", "ratings"),
                errors, item -> validateCriterion(item, errors));
        validateRemovals(operations.path("remove"), "rubric criterion", existing, errors);
    }

    private JsonNode rubricCriteria(ReviewRubricContext rubric) {
        var result = JsonNodeFactory.instance.objectNode();
        var criteria = result.putArray("criteria");
        for (ReviewRubricCriterionContext criterion : rubric.criteria()) {
            criteria.addObject().put("id", criterion.id().toString());
        }
        return result;
    }

    private void validateCriterion(JsonNode item, List<String> errors) {
        validateRequiredText(item, "code", 30, "Criterion code", errors);
        validateRequiredText(item, "name", 100, "Criterion name", errors);
        JsonNode description = item.get("description");
        if (description == null) errors.add("Criterion description field is required");
        else if (!description.isNull()) validateOptionalText(item, "description", 500, errors);
        validateRequiredNumberRange(item, "weight", new BigDecimal("0.01"), new BigDecimal("100"), errors);
        validateRequiredNumberRange(item, "maxScore", new BigDecimal("0.01"), null, errors);
        JsonNode order = item.get("orderIndex");
        if (order == null || !order.isIntegralNumber() || !order.canConvertToInt() || order.asInt() < 0) {
            errors.add("orderIndex must be a non-negative integer");
        }
        JsonNode ratings = item.get("ratings");
        if (ratings == null || !ratings.isArray() || ratings.size() != 4) {
            errors.add("ratings must contain exactly four rating levels");
            return;
        }
        Set<String> levels = new HashSet<>();
        for (JsonNode rating : ratings) {
            validateAllowedFields(rating, Set.of("level", "description"), "rating", errors);
            JsonNode level = rating.get("level");
            if (level == null || !level.isTextual()
                    || !Set.of("EXCELLENT", "GOOD", "FAIR", "NOT_MET").contains(level.asText())
                    || !levels.add(level.asText())) {
                errors.add("ratings must contain unique EXCELLENT, GOOD, FAIR and NOT_MET levels");
            }
            validateRequiredText(rating, "description", 500, "Rating description", errors);
        }
    }

    private void validateResourceChanges(
            JsonNode operations,
            ReviewFindingInput finding,
            ResolvedReviewFindingTarget resolved,
            List<String> errors
    ) {
        if (!validateOperations(operations, "resources", errors)) return;
        Long targetId = resolved.target() instanceof ReviewResourceContext resource ? resource.resourceId() : null;
        if (targetId == null || !String.valueOf(targetId).equals(finding.targetId())) {
            errors.add("Resource finding target is unavailable");
        }
        validateAdds(operations.path("add"), Set.of("title", "description", "kind", "url", "orderIndex"),
                "resource", errors, item -> validateResource(item, true, errors));
        validateTargetUpdates(operations.path("update"), finding.targetId(), "resource",
                Set.of("id", "title", "description", "kind", "url", "orderIndex"),
                errors, item -> validateResource(item, false, errors));
        validateTargetRemovals(operations.path("remove"), finding.targetId(), "resource", errors);
    }

    private void validateResource(JsonNode item, boolean adding, List<String> errors) {
        validateOptionalText(item, "title", 255, errors);
        if (adding) validateRequiredText(item, "title", 255, "Resource title", errors);
        validateOptionalText(item, "description", 1000, errors);
        JsonNode kind = item.get("kind");
        if (adding && (kind == null || !kind.isTextual())) errors.add("A new resource must specify kind");
        if (kind != null && (!kind.isTextual() || !Set.of("FILE", "LINK").contains(kind.asText()))) {
            errors.add("Resource kind must be FILE or LINK");
        }
        if (adding && kind != null && kind.isTextual() && "FILE".equals(kind.asText())) {
            errors.add("AI cannot create FILE resources without an uploaded file");
        }
        validateOptionalText(item, "url", 1000, errors);
        validateOptionalNonNegativeInteger(item, "orderIndex", errors);
        if (adding && kind != null && kind.isTextual() && "LINK".equals(kind.asText())) {
            validateRequiredText(item, "url", 1000, "LINK resource URL", errors);
        }
    }

    private boolean validateOperations(JsonNode operations, String section, List<String> errors) {
        if (operations == null || !operations.isObject()) {
            errors.add(section + " changes must be an object");
            return false;
        }
        boolean valid = true;
        for (String operation : List.of("add", "update", "remove")) {
            if (operations.has(operation) && !operations.get(operation).isArray()) {
                errors.add(section + "." + operation + " must be an array");
                valid = false;
            }
        }
        operations.fieldNames().forEachRemaining(operation -> {
            if (!Set.of("add", "update", "remove").contains(operation)) {
                errors.add("Unsupported " + section + " operation: " + operation);
            }
        });
        if (valid) {
            boolean hasOperation = false;
            for (String operation : List.of("add", "update", "remove")) {
                JsonNode values = operations.path(operation);
                if (values.isArray() && !values.isEmpty()) hasOperation = true;
            }
            if (!hasOperation) errors.add(section + " must contain at least one operation");
            validateOperationConflicts(operations, section, errors);
        }
        return valid;
    }

    private void validateOperationConflicts(JsonNode operations, String section, List<String> errors) {
        Set<String> updateIds = new HashSet<>();
        JsonNode updates = operations.path("update");
        if (updates.isArray()) {
            for (JsonNode item : updates) {
                JsonNode id = item.path("id");
                if (!id.isMissingNode() && !id.isNull() && !updateIds.add(id.asText())) {
                    errors.add("Duplicate " + section + " ID in update");
                }
            }
        }
        Set<String> removeIds = new HashSet<>();
        JsonNode removals = operations.path("remove");
        if (removals.isArray()) {
            for (JsonNode item : removals) {
                JsonNode id = removeId(item);
                if (id == null || id.isNull()) continue;
                String value = id.asText();
                if (!removeIds.add(value)) errors.add("Duplicate " + section + " ID in remove");
                if (updateIds.contains(value)) {
                    errors.add(section + " item cannot be both updated and removed");
                }
            }
        }
    }

    private void validateAdds(
            JsonNode items,
            Set<String> allowedFields,
            String label,
            List<String> errors,
            Consumer<JsonNode> validateFields
    ) {
        if (!items.isArray()) return;
        for (JsonNode item : items) {
            if (!item.isObject()) {
                errors.add("Added " + label + " must be an object");
                continue;
            }
            if (item.has("id")) errors.add("Added " + label + " must not contain an ID");
            validateAllowedFields(item, allowedFields, label, errors);
            validateFields.accept(item);
        }
    }

    private void validateUpdates(
            JsonNode items,
            String label,
            JsonNode existing,
            Set<String> allowedFields,
            List<String> errors,
            Consumer<JsonNode> validateFields
    ) {
        if (!items.isArray()) return;
        Set<String> ids = new HashSet<>();
        for (JsonNode item : items) {
            if (!item.isObject()) {
                errors.add("Updated " + label + " must be an object");
                continue;
            }
            validateAllowedFields(item, allowedFields, label, errors);
            JsonNode id = item.get("id");
            if (!validId(id, existing, label, errors)) continue;
            if (!ids.add(id.asText())) errors.add("Duplicate " + label + " ID in update");
            if (item.size() <= 1) errors.add("Updated " + label + " must include changed content");
            validateFields.accept(item);
        }
    }

    private void validateTargetUpdates(
            JsonNode items,
            String targetId,
            String label,
            Set<String> allowedFields,
            List<String> errors,
            Consumer<JsonNode> validateFields
    ) {
        if (!items.isArray()) return;
        for (JsonNode item : items) {
            if (!item.isObject()) {
                errors.add("Updated " + label + " must be an object");
                continue;
            }
            validateAllowedFields(item, allowedFields, label, errors);
            JsonNode id = item.get("id");
            if (id == null || !targetId.equals(id.asText())) {
                errors.add("Updated " + label + " must reference the finding target ID");
                continue;
            }
            if (item.size() <= 1) errors.add("Updated " + label + " must include changed content");
            validateFields.accept(item);
        }
    }

    private void validateRemovals(JsonNode items, String label, JsonNode existing, List<String> errors) {
        if (!items.isArray()) return;
        Set<String> ids = new HashSet<>();
        for (JsonNode item : items) {
            JsonNode id = removeId(item);
            if (!validId(id, existing, label, errors)) continue;
            if (!ids.add(id.asText())) errors.add("Duplicate " + label + " ID in remove");
        }
    }

    private void validateTargetRemovals(JsonNode items, String targetId, String label, List<String> errors) {
        if (!items.isArray()) return;
        for (JsonNode item : items) {
            JsonNode id = removeId(item);
            if (id == null || !targetId.equals(id.asText())) {
                errors.add("Removed " + label + " must reference the finding target ID");
            }
        }
    }

    private JsonNode removeId(JsonNode item) {
        if (item.isObject() && item.size() == 1) return item.get("id");
        return item.isValueNode() ? item : null;
    }

    private boolean validId(JsonNode id, JsonNode existing, String label, List<String> errors) {
        if (id == null || id.isNull()) {
            errors.add(label + " update/remove must include its existing ID");
            return false;
        }
        if (id.isTextual()) {
            try {
                UUID.fromString(id.asText());
            } catch (IllegalArgumentException exception) {
                errors.add(label + " ID must be a UUID");
                return false;
            }
        } else if (!id.isIntegralNumber() || !id.canConvertToLong() || id.asLong() <= 0) {
            errors.add(label + " ID must be a positive integer or UUID");
            return false;
        }
        if (existing != null && !containsId(existing, id.asText())) {
            errors.add(label + " ID does not belong to the finding target");
            return false;
        }
        return true;
    }

    private boolean containsId(JsonNode existing, String id) {
        JsonNode values = existing.isArray() ? existing : existing.path("criteria");
        for (JsonNode item : values) {
            if (item.hasNonNull("id") && id.equals(item.path("id").asText())) return true;
        }
        return false;
    }

    private void validateAllowedFields(
            JsonNode node,
            Set<String> allowedFields,
            String section,
            List<String> errors
    ) {
        if (node == null || !node.isObject()) {
            errors.add(section + " must be a JSON object");
            return;
        }
        node.fieldNames().forEachRemaining(field -> {
            if (!allowedFields.contains(field)) {
                errors.add("Unsupported field '" + field + "' in section " + section);
            }
        });
    }

    private void validateRequiredText(
            JsonNode node,
            String field,
            int maxLength,
            String label,
            List<String> errors
    ) {
        JsonNode value = node.get(field);
        if (value == null || !value.isTextual() || value.asText().isBlank()) {
            errors.add(label + " must be a non-blank string");
        } else if (value.asText().length() > maxLength) {
            errors.add(label + " exceeds maximum length of " + maxLength);
        }
    }

    private void validateOptionalText(JsonNode node, String field, int maxLength, List<String> errors) {
        JsonNode value = node.get(field);
        if (value == null) return;
        if (!value.isTextual() || value.asText().isBlank()) {
            errors.add(field + " must be a non-blank string");
        } else if (value.asText().length() > maxLength) {
            errors.add(field + " exceeds maximum length of " + maxLength);
        }
    }

    private void validateOptionalPositiveInteger(JsonNode node, String field, List<String> errors) {
        JsonNode value = node.get(field);
        if (value == null) return;
        if (!value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() <= 0) {
            errors.add(field + " must be a positive integer");
        }
    }

    private void validateOptionalNonNegativeInteger(JsonNode node, String field, List<String> errors) {
        JsonNode value = node.get(field);
        if (value != null && (!value.isIntegralNumber() || !value.canConvertToInt() || value.asInt() < 0)) {
            errors.add(field + " must be a non-negative integer");
        }
    }

    private void validateOptionalBoolean(JsonNode node, String field, List<String> errors) {
        JsonNode value = node.get(field);
        if (value != null && !value.isBoolean()) errors.add(field + " must be a boolean");
    }

    private void validateRequiredBoolean(JsonNode node, String field, String label, List<String> errors) {
        JsonNode value = node.get(field);
        if (value == null || !value.isBoolean()) errors.add(label + " must be a boolean");
    }

    private void validateOptionalNumberRange(
            JsonNode node,
            String field,
            BigDecimal minimum,
            BigDecimal maximum,
            boolean allowMinimum,
            List<String> errors
    ) {
        JsonNode value = node.get(field);
        if (value == null) return;
        if (!value.isNumber()) {
            errors.add(field + " must be a number");
            return;
        }
        BigDecimal number = value.decimalValue();
        if ((allowMinimum ? number.compareTo(minimum) < 0 : number.compareTo(minimum) <= 0)
                || maximum != null && number.compareTo(maximum) > 0) {
            errors.add(field + " is outside the permitted range");
        }
    }

    private void validateRequiredNumberRange(
            JsonNode node,
            String field,
            BigDecimal minimum,
            BigDecimal maximum,
            List<String> errors
    ) {
        JsonNode value = node.get(field);
        if (value == null || !value.isNumber()) {
            errors.add(field + " must be a number");
            return;
        }
        BigDecimal number = value.decimalValue();
        if (number.compareTo(minimum) < 0 || maximum != null && number.compareTo(maximum) > 0) {
            errors.add(field + " is outside the permitted range");
        }
    }
}
