package com.example.starter_project_2025.system.project.template.content;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.template.*;
import com.example.starter_project_2025.system.project.template.artifact.*;
import com.example.starter_project_2025.system.project.template.backlog.*;
import com.example.starter_project_2025.system.project.template.milestone.*;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEvent;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TemplateSampleContentService {
    private final ProjectTemplateRepository templates;
    private final TemplateBacklogItemRepository backlog;
    private final TemplateArtifactRequirementRepository artifacts;
    private final TemplateMilestoneRepository milestones;
    private final ProjectTemplateAccessService access;
    private final TemplateSampleContentValidator validator;
    private final ProjectTemplateAuditRepository audits;
    private final OutboxEventRepository events;
    private final ObjectMapper objectMapper;
    private final TemplateBacklogImportPolicy importPolicy;

    public TemplateSampleContentResponse get(Long id) {
        User user = access.requireUser("READ");
        ProjectTemplate template = findReadableTemplate(id, user);
        // Shared (tenant_id == null) templates are view-only.
        return load(template, access.can(user, "UPDATE") && template.getTenantId() != null);
    }

    public ProjectTemplate requireDraft(Long id) {
        User user = access.requireUser("UPDATE");
        ProjectTemplate template = findTemplate(id, user);
        if (template.getStatus() != ProjectTemplateStatus.DRAFT) {
            throw ProjectTemplateException.conflict("Only draft templates can be edited");
        }
        return template;
    }

    @Transactional
    public TemplateSampleContentResponse save(Long id, TemplateSampleContentRequest request) {
        ProjectTemplate template = requireDraft(id);
        User user = access.requireUser("UPDATE");
        validator.validate(request);
        if (!template.getLockVersion().equals(request.lockVersion().longValueExact())) {
            throw ProjectTemplateException.conflict("This template has changed. Reload it before saving your changes");
        }
        var oldBacklog = backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(id);
        var oldArtifacts = artifacts.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(id);
        var milestoneList = milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(id);
        var backlogById = oldBacklog.stream().collect(Collectors.toMap(TemplateBacklogItem::getId, Function.identity()));
        var artifactById = oldArtifacts.stream().collect(Collectors.toMap(TemplateArtifactRequirement::getId, Function.identity()));
        var milestoneById = milestoneList.stream().collect(Collectors.toMap(TemplateMilestone::getId, Function.identity()));
        checkReferences(request, backlogById, artifactById, milestoneById);
        String before = state(TemplateSampleContentResponse.from(template, oldBacklog, oldArtifacts, milestoneList, false, importPolicy.maxBytes()));
        template.setUpdatedAt(LocalDateTime.now());
        templates.saveAndFlush(template);

        List<TemplateBacklogItem> savedBacklog = new ArrayList<>();
        for (int i = 0; i < request.backlogItems().size(); i++) {
            var input = request.backlogItems().get(i);
            var item = input.id() == null ? new TemplateBacklogItem() : backlogById.get(input.savedId());
            item.setTemplate(template);
            item.setTitle(input.title().strip());
            item.setDescription(clean(input.description()));
            item.setSuggestedRole(input.suggestedRole());
            item.setOrderIndex(i);
            savedBacklog.add(item);
        }
        Set<Long> retainedBacklog = request.backlogItems().stream().map(TemplateSampleContentRequest.BacklogItem::savedId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        backlog.deleteAll(oldBacklog.stream().filter(item -> !retainedBacklog.contains(item.getId())).toList());
        backlog.saveAllAndFlush(savedBacklog);

        List<TemplateArtifactRequirement> savedArtifacts = new ArrayList<>();
        for (int i = 0; i < request.artifacts().size(); i++) {
            var input = request.artifacts().get(i);
            var item = input.id() == null ? new TemplateArtifactRequirement() : artifactById.get(input.savedId());
            item.setTemplate(template);
            item.setMilestone(milestoneById.get(input.savedMilestoneId()));
            item.setTitle(input.title().strip());
            item.setDescription(clean(input.description()));
            item.setType(input.type());
            item.getAllowedMimeTypes().clear();
            item.getAllowedMimeTypes().addAll(input.allowedMimeTypes());
            item.setOrderIndex(i);
            savedArtifacts.add(item);
        }
        Set<Long> retainedArtifacts = request.artifacts().stream().map(TemplateSampleContentRequest.Artifact::savedId)
                .filter(Objects::nonNull).collect(Collectors.toSet());
        artifacts.deleteAll(oldArtifacts.stream().filter(item -> !retainedArtifacts.contains(item.getId())).toList());
        artifacts.saveAllAndFlush(savedArtifacts);
        var response = TemplateSampleContentResponse.from(template, savedBacklog, savedArtifacts, milestoneList, true, importPolicy.maxBytes());
        String after = state(response);
        String correlationId = CorrelationIdFilter.currentId();
        audits.save(new ProjectTemplateAudit(template.getTenantId(), id, user.getId(),
                "PROJECT_TEMPLATE_SAMPLE_CONTENT_UPDATED", before, after, correlationId));
        try {
            String payload = objectMapper.writeValueAsString(Map.of("templateId", id, "tenantId", template.getTenantId(),
                    "actorId", user.getId(), "correlationId", correlationId, "content", objectMapper.readTree(after)));
            events.save(OutboxEvent.templateSampleContentUpdated(template.getTenantId(), id, payload, Instant.now()));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template content changes", exception);
        }
        return response;
    }

    private void checkReferences(TemplateSampleContentRequest request, Map<Long, TemplateBacklogItem> backlog,
            Map<Long, TemplateArtifactRequirement> artifacts, Map<Long, TemplateMilestone> milestones) {
        for (int i = 0; i < request.backlogItems().size(); i++) {
            var item = request.backlogItems().get(i);
            if (item.id() != null && !backlog.containsKey(item.savedId())) {
                notFound("backlogItems[" + i + "].id", "Backlog item was not found in this template");
            }
        }
        for (int i = 0; i < request.artifacts().size(); i++) {
            var item = request.artifacts().get(i);
            if (item.id() != null && !artifacts.containsKey(item.savedId())) {
                notFound("artifacts[" + i + "].id", "Artifact requirement was not found in this template");
            }
            if (!milestones.containsKey(item.savedMilestoneId())) {
                notFound("artifacts[" + i + "].milestoneId", "Milestone was not found in this template. Reload the milestone list");
            }
        }
    }

    private void notFound(String field, String message) {
        throw new ProjectTemplateException(404, message, Map.of(field, List.of(message)));
    }

    private ProjectTemplate findTemplate(Long id, User user) {
        return templates.findByIdAndTenantIdAndIsActiveTrue(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    /** Read-only: also resolves the shared catalogue ({@code tenant_id is null}). */
    private ProjectTemplate findReadableTemplate(Long id, User user) {
        return templates.findReadableById(id, user.getTenantId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Project template was not found"));
    }

    private TemplateSampleContentResponse load(ProjectTemplate template, boolean canEdit) {
        return TemplateSampleContentResponse.from(template, backlog.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()),
                artifacts.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()),
                milestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId()), canEdit, importPolicy.maxBytes());
    }

    private String clean(String value) {
        return value == null ? null : value.strip();
    }

    private String state(TemplateSampleContentResponse response) {
        try {
            return objectMapper.writeValueAsString(response);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record template content changes", exception);
        }
    }
}
