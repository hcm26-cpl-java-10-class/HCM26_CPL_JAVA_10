package com.example.starter_project_2025.system.project.aiassistant.service.apply;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.*;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.AiSuggestionService;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIApplyBatchRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotDTO;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionStatus;
import com.example.starter_project_2025.system.project.resources.ResourceKind;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceRequest;
import com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceVersionService;
import com.example.starter_project_2025.system.project.rubric.domain.RubricRatingLevel;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.dto.*;
import com.example.starter_project_2025.system.project.rubric.service.RubricService;
import com.example.starter_project_2025.system.project.template.ProjectTemplateRequest;
import com.example.starter_project_2025.system.project.template.ProjectTemplateResponse;
import com.example.starter_project_2025.system.project.template.ProjectTemplateService;
import com.example.starter_project_2025.system.project.template.TemplateTeamConstraintsRequest;
import com.example.starter_project_2025.system.project.template.content.TemplateSampleContentRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.project.template.version.TemplateVersionConfigurationResponse;
import com.example.starter_project_2025.system.project.template.version.TemplateVersionConfigurationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AIApplyService {

    private final ProjectTemplateService projectTemplateService;
    private final ProjectTemplateSnapshotService snapshotService;
    private final TemplateVersionConfigurationService templateVersionConfigurationService;
    private final RubricService rubricService;
    private final TemplateResourceVersionService templateResourceVersionService;
    private final AiSuggestionService aiSuggestionService;
    private final AIApplyBatchService aiApplyBatchService;
    private final AIApplyBatchRepository aiApplyBatchRepository;

    private ProjectTemplateResponse createMasterTemplate(
            GeneratedTemplateOutput output
    ) {
        ProjectTemplateOutput projectTemplate = output.projectTemplate();

        ProjectTemplateRequest request = new ProjectTemplateRequest(
                projectTemplate.code(),
                projectTemplate.name(),
                projectTemplate.description(),
                projectTemplate.category(),
                projectTemplate.level(),
                projectTemplate.estimatedDurationWeeks() == null
                        ? null
                        : BigDecimal.valueOf(projectTemplate.estimatedDurationWeeks()),
                null,
                null,
                projectTemplate.technologyStack()
        );

        return projectTemplateService.create(request);
    }

    private Long getDraftSnapshotId(Long templateId) {

        return snapshotService.getByTemplate(templateId)
                .stream()
                .filter(snapshot ->
                        snapshot.getProjectId() == null
                                && snapshot.getStatus() == ProjectTemplateVersionStatus.DRAFT
                )
                .findFirst()
                .map(ProjectTemplateSnapshotDTO::getId)
                .orElseThrow(() -> new IllegalStateException(
                        "Draft snapshot not found for Project Template: " + templateId
                ));
    }

    private Long applyTeamConstraints(
            Long snapshotId,
            Long lockVersion,
            TeamConstraintsOutput output
    ) {
        TemplateTeamConstraintsRequest request = new TemplateTeamConstraintsRequest(
                BigDecimal.valueOf(output.minMembers()),
                BigDecimal.valueOf(output.maxMembers()),
                new TemplateTeamConstraintsRequest.RoleQuotas(
                        BigDecimal.valueOf(output.roleQuotas().pm()),
                        BigDecimal.valueOf(output.roleQuotas().ba()),
                        BigDecimal.valueOf(output.roleQuotas().dev()),
                        BigDecimal.valueOf(output.roleQuotas().qa())
                ),
                output.allowMultiRole(),
                BigDecimal.valueOf(lockVersion)
        );

        TemplateVersionConfigurationResponse response =
                templateVersionConfigurationService.saveTeam(snapshotId, request);

        return response.template().lockVersion();
    }

    private List<RubricCriterionRequest> mapRubricCriteria(
            List<RubricCriterionOutput> criteria
    ) {
        return criteria.stream()
                .map(criterion -> new RubricCriterionRequest(
                        criterion.code(),
                        criterion.name(),
                        criterion.description(),
                        criterion.weight(),
                        criterion.maxScore(),
                        criterion.orderIndex(),
                        criterion.ratings().stream()
                                .map(rating -> new RubricRatingRequest(
                                        RubricRatingLevel.valueOf(rating.level()),
                                        rating.description()
                                ))
                                .toList()
                ))
                .toList();
    }

    private UUID createAndPublishRubric(
            String templateCode,
            MilestoneOutput milestone
    ) {
        String rubricName = templateCode + " - " + milestone.title();

        SaveRubricDraftRequest request = new SaveRubricDraftRequest(
                rubricName,
                milestone.description(),
                mapRubricCriteria(milestone.rubricCriteria())
        );

        // 1. Create Rubric and its first DRAFT version
        RubricDetailResponse createdRubric = rubricService.create(request);

        // 2. Find the newly created DRAFT version
        RubricVersionResponse draftVersion = createdRubric.versions()
                .stream()
                .filter(version -> version.status() == RubricVersionStatus.DRAFT)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Draft Rubric Version not found for Rubric: " + rubricName
                ));

        // 3. Publish the Rubric Version
        rubricService.publish(createdRubric.id(), draftVersion.id());

        // 4. Return the published Rubric Version ID
        return draftVersion.id();
    }

    private TemplateMilestonePlanRequest mapMilestones(
            String templateCode,
            List<MilestoneOutput> milestones,
            Long lockVersion
    ) {
        List<TemplateMilestonePlanRequest.Milestone> mappedMilestones =
                milestones.stream()
                        .map(milestone -> {

                            // 1. Create and publish Rubric for this Milestone
                            UUID rubricVersionId = createAndPublishRubric(
                                    templateCode,
                                    milestone
                            );

                            // 2. Map Checklist Items
                            List<TemplateMilestonePlanRequest.ChecklistItem> checklistItems =
                                    milestone.checklistItems().stream()
                                            .map(item ->
                                                    new TemplateMilestonePlanRequest.ChecklistItem(
                                                            null,
                                                            item.content(),
                                                            item.mandatory()
                                                    )
                                            )
                                            .toList();

                            // 3. Map Late Policy
                            TemplateMilestonePlanRequest.LatePolicy latePolicy =
                                    new TemplateMilestonePlanRequest.LatePolicy(
                                            milestone.allowLateSubmission(),
                                            milestone.maxLateDays() == null
                                                    ? null
                                                    : BigDecimal.valueOf(milestone.maxLateDays()),
                                            milestone.penaltyPerDayPercent()
                                    );

                            // 4. Map Milestone
                            return new TemplateMilestonePlanRequest.Milestone(
                                    null,
                                    milestone.title(),
                                    milestone.description(),
                                    milestone.dueAfter() == null
                                            ? null
                                            : BigDecimal.valueOf(milestone.dueAfter()),
                                    TemplateMilestoneTimeUnit.valueOf(milestone.dueUnit()),
                                    milestone.weight(),
                                    milestone.mandatory(),
                                    rubricVersionId,
                                    checklistItems,
                                    latePolicy
                            );
                        })
                        .toList();

        return new TemplateMilestonePlanRequest(
                BigDecimal.valueOf(lockVersion),
                mappedMilestones
        );
    }

    private Long applyMilestones(
            Long snapshotId,
            String templateCode,
            Long lockVersion,
            List<MilestoneOutput> milestones
    ) {
        TemplateMilestonePlanRequest request =
                mapMilestones(templateCode, milestones, lockVersion);

        TemplateVersionConfigurationResponse response =
                templateVersionConfigurationService.saveMilestones(snapshotId, request);

        return response.template().lockVersion();
    }

    private ProjectTemplateResponse applyBacklog(
            Long snapshotId,
            Long lockVersion,
            List<BacklogItemOutput> backlogItems
    ) {
        TemplateSampleContentRequest request = new TemplateSampleContentRequest(
                BigDecimal.valueOf(lockVersion),
                (backlogItems == null ? List.<BacklogItemOutput>of() : backlogItems).stream()
                        .map(item -> new TemplateSampleContentRequest.BacklogItem(
                                null,
                                item.title(),
                                item.description(),
                                ProjectMemberRole.valueOf(item.suggestedRole())
                        ))
                        .toList()
        );

        TemplateVersionConfigurationResponse response =
                templateVersionConfigurationService.saveBacklog(snapshotId, request);

        return response.template();
    }

    private List<ProjectTemplateResponse> applyModules(
            Long masterTemplateId,
            List<ModuleOutput> modules
    ) {
        return (modules == null ? List.<ModuleOutput>of() : modules).stream()
                .map(module -> {
                    ProjectTemplateRequest request = new ProjectTemplateRequest(
                            module.code(),
                            module.name(),
                            module.description(),
                            module.category(),
                            module.level(),
                            module.estimatedDurationWeeks() == null
                                    ? null
                                    : BigDecimal.valueOf(module.estimatedDurationWeeks()),
                            null,
                            masterTemplateId,
                            module.technologyStack()
                    );

                    return projectTemplateService.create(request);
                })
                .toList();
    }

    private void applyResources(
            Long snapshotId,
            List<ResourceOutput> resources
    ) {
        for (ResourceOutput resource : resources == null ? List.<ResourceOutput>of() : resources) {
            TemplateResourceRequest request = new TemplateResourceRequest(
                    resource.title(),
                    resource.description(),
                    ResourceKind.LINK,
                    resource.url(),
                    resource.orderIndex()
            );

            templateResourceVersionService.create(snapshotId, request);
        }
    }

    @Transactional
    public ProjectTemplateResponse applyApprovedSuggestion(Long suggestionId) {
        var existingBatch = aiApplyBatchRepository.findBySuggestion_Id(suggestionId);
        if (existingBatch.isPresent()) {
            return projectTemplateService.getById(
                    existingBatch.get().getProjectTemplate().getId()
            );
        }

        // 1. Lấy dữ liệu AI từ Suggestion đã APPROVED
        GeneratedTemplateOutput output =
                aiSuggestionService.getApprovedOutputForApply(suggestionId);

        // 2. Tạo Master ProjectTemplate
        ProjectTemplateResponse masterTemplate =
                createMasterTemplate(output);

        // 3. Lấy ID của Draft Snapshot vừa được tạo
        Long snapshotId =
                getDraftSnapshotId(masterTemplate.id());

        // 4. Apply Team Constraints
        Long lockVersion = applyTeamConstraints(
                snapshotId,
                masterTemplate.lockVersion(),
                output.teamConstraints()
        );

        // 5. Apply Milestones và Rubrics
        lockVersion = applyMilestones(
                snapshotId,
                masterTemplate.code(),
                lockVersion,
                output.milestones()
        );

        // 6. Apply Backlog
        ProjectTemplateResponse updatedTemplate = applyBacklog(
                snapshotId,
                lockVersion,
                output.backlogItems()
        );

        // 7. Apply Modules
        applyModules(
                masterTemplate.id(),
                output.modules()
        );

        // 8. Apply Resources
        applyResources(
                snapshotId,
                output.resources()
        );

        // 9. Tạo ApplyBatch để ghi nhận lịch sử Apply
        aiApplyBatchService.createApplyBatch(
                suggestionId,
                masterTemplate.id()
        );

        // 10. Chuyển Suggestion sang APPLIED
        aiSuggestionService.markApplied(suggestionId);

        return updatedTemplate;
    }
}