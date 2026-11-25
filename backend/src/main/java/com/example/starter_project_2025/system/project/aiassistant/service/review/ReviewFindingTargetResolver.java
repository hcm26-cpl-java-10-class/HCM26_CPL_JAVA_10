package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.dto.*;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.review.ReviewFindingInput;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.aspectj.util.LangUtil.safeList;

@Component
public class ReviewFindingTargetResolver {

    public ResolvedReviewFindingTarget resolve(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        validateFinding(finding);
        if (context == null) {
            throw new IllegalArgumentException("Review context is required");
        }

        return switch (finding.category()) {
            case PROJECT_TEMPLATE, MODULE ->
                    resolveTemplateTarget(finding, context);

            case MILESTONE ->
                    resolveMilestone(finding, context);

            case BACKLOG ->
                    resolveBacklog(finding, context);

            case RUBRIC ->
                    resolveRubric(finding, context);

            case DOCUMENT ->
                    resolveDocument(finding, context);
        };
    }

    private void validateFinding(ReviewFindingInput finding) {
        if (finding == null) {
            throw new IllegalArgumentException("Review finding is required");
        }

        if (finding.category() == null) {
            throw new IllegalArgumentException("Finding category is required");
        }

        if (finding.targetType() == null || finding.targetType().isBlank()) {
            throw new IllegalArgumentException("Finding target type is required");
        }

        if (finding.targetId() == null || finding.targetId().isBlank()) {
            throw new IllegalArgumentException("Finding target ID is required");
        }

        String expectedTargetType = switch (finding.category()) {
            case PROJECT_TEMPLATE, MODULE -> "PROJECT_TEMPLATE";
            case MILESTONE -> "TEMPLATE_MILESTONE";
            case BACKLOG -> "TEMPLATE_BACKLOG_ITEM";
            case RUBRIC -> "RUBRIC_VERSION";
            case DOCUMENT -> "TEMPLATE_RESOURCE";
        };

        if (!expectedTargetType.equals(finding.targetType())) {
            throw new IllegalArgumentException(
                    "Invalid target type for finding category " + finding.category()
            );
        }
    }

    private ResolvedReviewFindingTarget resolveTemplateTarget(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        return switch (finding.category()) {
            case PROJECT_TEMPLATE -> resolveProjectTemplate(finding, context);
            case MODULE -> resolveModule(finding, context);
            default -> throw new IllegalArgumentException(
                    "Unsupported category for template target: " + finding.category()
            );
        };
    }

    private ResolvedReviewFindingTarget resolveProjectTemplate(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        String expectedId = String.valueOf(context.templateId());

        if (!expectedId.equals(finding.targetId())) {
            throw new IllegalArgumentException(
                    "Finding target does not match the current project template"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                context.templateId(),
                context.snapshotId(),
                context
        );
    }

    private ReviewTemplateNode findModuleRecursively(
            List<ReviewTemplateNode> modules,
            Long targetTemplateId
    ) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }

        for (ReviewTemplateNode module : modules) {
            if (targetTemplateId.equals(module.templateId())) {
                return module;
            }

            ReviewTemplateNode nestedModule = findModuleRecursively(
                    module.modules(),
                    targetTemplateId
            );

            if (nestedModule != null) {
                return nestedModule;
            }
        }

        return null;
    }

    private ResolvedReviewFindingTarget resolveModule(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        Long targetTemplateId;

        try {
            targetTemplateId = Long.valueOf(finding.targetId());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid module target ID", e);
        }

        ReviewTemplateNode module = findModuleRecursively(
                context.modules(),
                targetTemplateId
        );

        if (module == null) {
            throw new IllegalArgumentException(
                    "Module target does not exist in review context"
            );
        }

        if (module.snapshotId() == null) {
            throw new IllegalArgumentException(
                    "Cannot generate suggestion for a module without a snapshot"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                module.templateId(),
                module.snapshotId(),
                module
        );
    }


    private record TargetLocation(
            Long templateId,
            Long snapshotId,
            Object target
    ) {}

    private List<TargetLocation> findMilestones(
            ReviewContext context,
            String targetId
    ) {
        List<TargetLocation> matches = new java.util.ArrayList<>();

        for (JsonNode milestone : safeList(context.milestones())) {
            if (hasId(milestone, targetId)) {
                matches.add(new TargetLocation(
                        context.templateId(),
                        context.snapshotId(),
                        milestone
                ));
            }
        }

        collectMilestonesRecursively(
                context.modules(),
                targetId,
                matches
        );

        return matches;
    }

    private void collectMilestonesRecursively(
            List<ReviewTemplateNode> modules,
            String targetId,
            List<TargetLocation> matches
    ) {
        if (modules == null || modules.isEmpty()) {
            return;
        }

        for (ReviewTemplateNode module : modules) {
            for (JsonNode milestone : safeList(module.milestones())) {
                if (hasId(milestone, targetId)) {
                    matches.add(new TargetLocation(
                            module.templateId(),
                            module.snapshotId(),
                            milestone
                    ));
                }
            }

            collectMilestonesRecursively(
                    module.modules(),
                    targetId,
                    matches
            );
        }
    }

    private TargetLocation findBacklog(
            ReviewContext context,
            String targetId
    ) {
        for (JsonNode item : safeList(context.backlogItems())) {
            if (hasId(item, targetId)) {
                return new TargetLocation(
                        context.templateId(),
                        context.snapshotId(),
                        item
                );
            }
        }

        return findBacklogRecursively(context.modules(), targetId);
    }

    private List<JsonNode> safeList(List<JsonNode> items) {
        return items == null ? Collections.emptyList() : items;
    }

    private boolean hasId(JsonNode node, String targetId) {
        if (node == null || !node.isObject()) {
            return false;
        }

        JsonNode idNode = node.get("id");

        return idNode != null
                && !idNode.isNull()
                && idNode.asText().equals(targetId);
    }

    private TargetLocation findMilestoneRecursively(
            List<ReviewTemplateNode> modules,
            String targetId
    ) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }

        for (ReviewTemplateNode module : modules) {
            for (JsonNode milestone : safeList(module.milestones())) {
                if (hasId(milestone, targetId)) {
                    return new TargetLocation(
                            module.templateId(),
                            module.snapshotId(),
                            milestone
                    );
                }
            }

            TargetLocation nested = findMilestoneRecursively(
                    module.modules(),
                    targetId
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    private TargetLocation findBacklogRecursively(
            List<ReviewTemplateNode> modules,
            String targetId
    ) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }

        for (ReviewTemplateNode module : modules) {
            for (JsonNode item : safeList(module.backlogItems())) {
                if (hasId(item, targetId)) {
                    return new TargetLocation(
                            module.templateId(),
                            module.snapshotId(),
                            item
                    );
                }
            }

            TargetLocation nested = findBacklogRecursively(
                    module.modules(),
                    targetId
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    private TargetLocation requireUniqueTarget(
            List<TargetLocation> matches,
            String targetType
    ) {
        if (matches.isEmpty()) {
            throw new IllegalArgumentException(
                    targetType + " target does not exist in review context"
            );
        }

        if (matches.size() > 1) {
            throw new IllegalArgumentException(
                    targetType + " target is ambiguous in review context"
            );
        }

        return matches.get(0);
    }

    private ResolvedReviewFindingTarget resolveMilestone(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        TargetLocation location = requireUniqueTarget(
                findMilestones(context, finding.targetId()),
                "Milestone"
        );

        if (location.snapshotId() == null) {
            throw new IllegalArgumentException(
                    "Cannot generate suggestion for a milestone without a snapshot"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                location.templateId(),
                location.snapshotId(),
                location.target()
        );
    }

    private ResolvedReviewFindingTarget resolveBacklog(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        TargetLocation location = findBacklog(context, finding.targetId());

        if (location == null) {
            throw new IllegalArgumentException(
                    "Backlog target does not exist in review context"
            );
        }

        if (location.snapshotId() == null) {
            throw new IllegalArgumentException(
                    "Cannot generate suggestion for a backlog item without a snapshot"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                location.templateId(),
                location.snapshotId(),
                location.target()
        );
    }

    private TargetLocation findRubric(
            ReviewContext context,
            String targetId
    ) {
        for (ReviewRubricContext rubric : safeRubricList(context.rubrics())) {
            if (rubric.rubricVersionId() != null
                    && rubric.rubricVersionId().toString().equals(targetId)) {
                return new TargetLocation(
                        context.templateId(),
                        context.snapshotId(),
                        rubric
                );
            }
        }

        return findRubricRecursively(context.modules(), targetId);
    }

    private TargetLocation findRubricRecursively(
            List<ReviewTemplateNode> modules,
            String targetId
    ) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }

        for (ReviewTemplateNode module : modules) {
            for (ReviewRubricContext rubric : safeRubricList(module.rubrics())) {
                if (rubric.rubricVersionId() != null
                        && rubric.rubricVersionId().toString().equals(targetId)) {
                    return new TargetLocation(
                            module.templateId(),
                            module.snapshotId(),
                            rubric
                    );
                }
            }

            TargetLocation nested = findRubricRecursively(
                    module.modules(),
                    targetId
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    private List<ReviewRubricContext> safeRubricList(
            List<ReviewRubricContext> rubrics
    ) {
        return rubrics == null ? Collections.emptyList() : rubrics;
    }

    private ResolvedReviewFindingTarget resolveRubric(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        try {
            UUID.fromString(finding.targetId());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException(
                    "Invalid rubric version target ID",
                    e
            );
        }

        TargetLocation location = findRubric(context, finding.targetId());

        if (location == null) {
            throw new IllegalArgumentException(
                    "Rubric version target does not exist in review context"
            );
        }

        if (location.snapshotId() == null) {
            throw new IllegalArgumentException(
                    "Cannot generate suggestion for a rubric without a snapshot"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                location.templateId(),
                location.snapshotId(),
                location.target()
        );
    }

    private TargetLocation findResource(
            ReviewContext context,
            String targetId
    ) {
        for (ReviewResourceContext resource : safeResourceList(context.resources())) {
            if (resource.resourceId() != null
                    && resource.resourceId().toString().equals(targetId)) {
                return new TargetLocation(
                        context.templateId(),
                        context.snapshotId(),
                        resource
                );
            }
        }

        return findResourceRecursively(context.modules(), targetId);
    }

    private TargetLocation findResourceRecursively(
            List<ReviewTemplateNode> modules,
            String targetId
    ) {
        if (modules == null || modules.isEmpty()) {
            return null;
        }

        for (ReviewTemplateNode module : modules) {
            for (ReviewResourceContext resource : safeResourceList(module.resources())) {
                if (resource.resourceId() != null
                        && resource.resourceId().toString().equals(targetId)) {
                    return new TargetLocation(
                            module.templateId(),
                            module.snapshotId(),
                            resource
                    );
                }
            }

            TargetLocation nested = findResourceRecursively(
                    module.modules(),
                    targetId
            );

            if (nested != null) {
                return nested;
            }
        }

        return null;
    }

    private List<ReviewResourceContext> safeResourceList(
            List<ReviewResourceContext> resources
    ) {
        return resources == null ? Collections.emptyList() : resources;
    }

    private ResolvedReviewFindingTarget resolveDocument(
            ReviewFindingInput finding,
            ReviewContext context
    ) {
        Long resourceId;

        try {
            resourceId = Long.valueOf(finding.targetId());
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Invalid resource target ID",
                    e
            );
        }

        TargetLocation location = findResource(context, resourceId.toString());

        if (location == null) {
            throw new IllegalArgumentException(
                    "Resource target does not exist in review context"
            );
        }

        if (location.snapshotId() == null) {
            throw new IllegalArgumentException(
                    "Cannot generate suggestion for a resource without a snapshot"
            );
        }

        return new ResolvedReviewFindingTarget(
                finding.category(),
                finding.targetType(),
                finding.targetId(),
                location.templateId(),
                location.snapshotId(),
                location.target()
        );
    }



}