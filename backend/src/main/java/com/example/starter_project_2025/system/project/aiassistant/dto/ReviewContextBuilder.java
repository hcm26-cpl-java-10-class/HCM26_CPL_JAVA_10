package com.example.starter_project_2025.system.project.aiassistant.dto;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewResourceContextMapper;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewRubricContextMapper;
import com.example.starter_project_2025.system.project.aiassistant.dto.SnapshotReviewDataMapper;
import com.example.starter_project_2025.system.project.aiassistant.service.review.TemplateSnapshotRetrievalService;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRepository;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;

@Component
@RequiredArgsConstructor
public class ReviewContextBuilder {

    private final TemplateSnapshotRetrievalService snapshotRetrievalService;

    private final SnapshotReviewDataMapper snapshotReviewDataMapper;

    private final TemplateResourceRepository resourceRepository;

    private final ReviewResourceContextMapper resourceContextMapper;

    private final RubricCatalogService rubricCatalogService;

    private final ReviewRubricContextMapper rubricContextMapper;


    @Transactional(readOnly = true)
    public ReviewContext build(ProjectTemplate template, Long snapshotId) {

        ProjectTemplateSnapshot snapshot =
                snapshotRetrievalService.retrieve(template.getId(), snapshotId);

        SnapshotReviewData snapshotData =
                snapshotReviewDataMapper.toData(snapshot);

        if (!template.getId().equals(snapshot.getTemplateId())) {
            throw new IllegalStateException(
                    "Snapshot does not belong to the specified template"
            );
        }

        Long tenantId = template.getTenantId();

        if (tenantId != null && tenantId <= 0) {
            throw new IllegalStateException(
                    "Project template does not have a valid tenant"
            );
        }

        List<ReviewResourceContext> resources =
                buildResources(snapshot.getId(), template.getId(), tenantId);

        Set<UUID> rubricVersionIds = extractRubricVersionIds(snapshotData);

        List<ReviewRubricContext> rubrics =
                buildRubrics(rubricVersionIds, tenantId);

        List<ReviewTemplateNode> modules =
                buildModuleNodes(snapshotData.modules(), tenantId);

        return new ReviewContext(
                template.getId(),
                snapshot.getId(),
                snapshotData.templateVersion(),
                snapshotData.code(),
                snapshotData.name(),
                snapshotData.description(),
                snapshotData.technologyStack(),
                snapshotData.category(),
                snapshotData.level(),
                snapshotData.estimatedDurationWeeks(),
                snapshotData.constraints(),
                snapshotData.milestones(),
                snapshotData.backlogItems(),
                modules,
                resources,
                rubrics
        );
    }

    private Set<UUID> extractRubricVersionIds(SnapshotReviewData data) {
        return data.milestones().stream()
                .map(milestone -> milestone.get("rubricVersionId"))
                .filter(node -> node != null && !node.isNull())
                .map(node -> UUID.fromString(node.asText()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private List<ReviewRubricContext> buildRubrics(
            Set<UUID> rubricVersionIds,
            Long tenantId
    ) {
        Long rubricTenantId = tenantId == null ? 1L : tenantId;

        return rubricVersionIds.stream()
                .map(id -> rubricCatalogService.findByIdForTenant(id, rubricTenantId)
                        .orElseThrow(() -> new IllegalStateException(
                                "Rubric version not found: " + id
                        )))
                .map(rubricContextMapper::toContext)
                .toList();
    }

    private List<ReviewTemplateNode> buildModuleNodes(
            JsonNode modules,
            Long tenantId
    ) {
        if (modules == null || !modules.isArray()) {
            return List.of();
        }

        return StreamSupport.stream(modules.spliterator(), false)
                .map(module -> buildModuleNode(module, tenantId))
                .toList();
    }

    private ReviewTemplateNode buildModuleNode(
            JsonNode module,
            Long tenantId
    ) {
        Long moduleTemplateId = module.path("templateId").asLong();

        if (moduleTemplateId <= 0) {
            throw new IllegalStateException(
                    "Module does not have a valid templateId"
            );
        }

        JsonNode versionIdNode = module.get("versionId");

        // Module chưa từng Published: chỉ review metadata.
        if (versionIdNode == null || versionIdNode.isNull()) {
            return new ReviewTemplateNode(
                    moduleTemplateId,
                    null,
                    module.hasNonNull("templateVersion")
                            ? module.get("templateVersion").asInt()
                            : null,
                    text(module, "code"),
                    text(module, "name"),
                    null,
                    null,
                    text(module, "category"),
                    null,
                    null,
                    null,
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of(),
                    List.of()
            );
        }

        Long moduleSnapshotId = versionIdNode.asLong();

        ProjectTemplateSnapshot moduleSnapshot =
                snapshotRetrievalService.retrieveReferencedModuleSnapshot(
                        moduleTemplateId,
                        moduleSnapshotId
                );

        SnapshotReviewData moduleData =
                snapshotReviewDataMapper.toData(moduleSnapshot);

        if (!moduleTemplateId.equals(moduleData.templateId())) {
            throw new IllegalStateException(
                    "Module snapshot content does not match its template"
            );
        }

        List<ReviewResourceContext> resources =
                buildResources(moduleSnapshotId, moduleTemplateId, tenantId);

        List<ReviewRubricContext> rubrics =
                buildRubrics(extractRubricVersionIds(moduleData), tenantId);

        List<ReviewTemplateNode> children =
                buildModuleNodes(moduleData.modules(), tenantId);

        return new ReviewTemplateNode(
                moduleTemplateId,
                moduleSnapshotId,
                module.hasNonNull("templateVersion")
                        ? module.get("templateVersion").asInt()
                        : moduleData.templateVersion(),
                text(module, "code"),
                text(module, "name"),
                moduleData.description(),
                moduleData.technologyStack(),
                text(module, "category"),
                moduleData.level(),
                moduleData.estimatedDurationWeeks(),
                moduleData.constraints(),
                moduleData.milestones(),
                moduleData.backlogItems(),
                resources,
                rubrics,
                children
        );
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);

        return value == null || value.isNull()
                ? null
                : value.asText();
    }

    private List<ReviewResourceContext> buildResources(
            Long snapshotId,
            Long templateId,
            Long tenantId
    ) {
        if (tenantId == null) {
            return List.of();
        }

        return resourceRepository
                .findAllByTemplateVersionIdAndTemplateIdAndTenantIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(
                        snapshotId,
                        templateId,
                        tenantId
                )
                .stream()
                .map(resourceContextMapper::toContext)
                .toList();
    }
}