package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneAccessPolicy;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import com.example.starter_project_2025.system.project.milestone.service.WorkspaceMilestoneScopeService;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactDraft;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ArtifactAttachmentRepository;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactDraftRequest;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactDraftResponse;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionWorkspaceResponse;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactDraftRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArtifactDraftService {
    private final CurrentActorProvider actorProvider;
    private final MilestoneTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final ArtifactSubmissionScopePort submissionScope;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository milestoneRepository;
    private final MilestoneQueryService milestoneQueryService;
    private final MilestoneArtifactDraftRepository draftRepository;
    private final MilestoneArtifactSubmissionRepository submissionRepository;
    private final ArtifactSubmissionService submissionService;
    private final ArtifactAttachmentRepository attachmentRepository;
    private final MilestoneAuditRepository auditRepository;
    private final OutboxEventWriter outboxWriter;
    private final ObjectMapper objectMapper;
    private final ArtifactContributionLock contributionLock;
    private final ClamAvScanner clamAvScanner;
    private final WorkspaceMilestoneScopeService scopeService;
    private final MilestoneSubmissionWindow submissionWindow;
    @org.springframework.beans.factory.annotation.Value("${app.artifact.upload.enabled:false}")
    private boolean uploadEnabled;
    @org.springframework.beans.factory.annotation.Value("${app.artifact.upload.max-bytes:0}")
    private long uploadMaxBytes;
    @org.springframework.beans.factory.annotation.Value("${app.artifact.upload.allowed-mime-types:}")
    private String uploadAllowedMimeTypes;

    @Transactional
    public ArtifactSubmissionWorkspaceResponse getWorkspace(Long projectId, UUID milestoneId) {
        Scope scope = requireScope(projectId);
        var milestone = resolveMilestone(projectId, milestoneId, scope.tenantId());
        if (milestone.getStatus() != com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus.OPEN
                || (milestone.lifecycleStatus() == com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus.PLANNED
                    && milestone.getStatus() == com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus.OPEN))
            throw new ResourceNotFoundException("Milestone not available to students");
        var draft = draftRepository.findByMilestoneIdAndProjectIdAndTenantId(milestoneId, projectId, scope.tenantId())
                .map(this::toResponse).orElse(null);
        var latestSubmission = submissionRepository
                .findTopByTenantIdAndProjectIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
                        scope.tenantId(), projectId, milestoneId, scope.actorId())
                .map(submissionService::toResponse).orElse(null);
        return new ArtifactSubmissionWorkspaceResponse(
                milestoneQueryService.getDetail(projectId, milestoneId, null), draft,
                uploadPolicy(), latestSubmission, submissionWindow.canSubmitNow(milestone));
    }

    @Transactional
    public ArtifactDraftResponse save(Long projectId, UUID milestoneId, ArtifactDraftRequest request) {
        Scope scope = requireScope(projectId);
        contributionLock.lockCurrentActor();
        var milestone = resolveMilestone(projectId, milestoneId, scope.tenantId());
        if (!submissionWindow.canSubmit(milestone))
            throw new ResourceNotFoundException("Milestone not available to students");
        validateUrl("repositoryUrl", request.repositoryUrl());
        validateUrl("deploymentUrl", request.deploymentUrl());
        Map<UUID, Boolean> checklist = validateChecklist(milestone, request.checklist());
        String checklistJson = writeChecklist(checklist);
        Instant now = Instant.now();
        var existingDraft = draftRepository
                .findByMilestoneIdAndProjectIdAndTenantId(milestoneId, projectId, scope.tenantId());
        boolean creating = existingDraft.isEmpty();
        MilestoneArtifactDraft draft = existingDraft.orElseGet(() -> MilestoneArtifactDraft.create(
                milestoneId, projectId, scope.tenantId(), scope.actorId(), now, checklistJson));
        boolean sameContent = sameContent(draft, request, checklistJson);
        if (!creating && request.expectedVersion() == null && !sameContent) {
            throw new MilestoneConflictException("Draft version is required. Reload the draft before saving.");
        }
        if (request.expectedVersion() != null && request.expectedVersion() != draft.getVersion() && !sameContent) {
            throw new MilestoneConflictException("Draft changed in another session. Reload before saving.");
        }
        if (sameContent && !creating) return toResponse(draft);
        Map<String, Object> before = draftDetails(draft);
        draft.update(scope.actorId(), now, blankToNull(request.repositoryUrl()),
                blankToNull(request.deploymentUrl()), blankToNull(request.releaseNotes()), checklistJson);
        draft = draftRepository.saveAndFlush(draft);
        Map<String, Object> after = draftDetails(draft);
        try {
            auditRepository.save(MilestoneAuditLog.artifactDraftSaved(milestoneId, projectId, scope.tenantId(),
                    scope.actorId(), CorrelationIdFilter.currentId(),
                    objectMapper.writeValueAsString(Map.of("before", before, "after", after)), now));
            outboxWriter.writeArtifactDraftSaved(milestoneId, projectId, scope.tenantId(),
                    scope.actorId(), draft.getVersion(), now);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact draft audit", ex);
        }
        return toResponse(draft);
    }

    private Scope requireScope(Long projectId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        Long tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);
        submissionScope.requireStudentProjectAccess(projectId, actorId, tenantId);
        return new Scope(actorId, tenantId);
    }

    /**
     * Legacy milestones were historically stored with only team scope. Resolve that
     * scope through the active team and persist the canonical project scope before
     * the artifact workflow reads or writes any project-scoped row.
     */
    private com.example.starter_project_2025.system.project.milestone.domain.Milestone resolveMilestone(
            Long projectId, UUID milestoneId, Long tenantId) {
        var strict = milestoneRepository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive);
        if (strict.isPresent()) return strict.get();

        var legacy = milestoneRepository.findByIdAndTenantId(milestoneId, tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        if (legacy.getProjectId() != null) throw new ResourceNotFoundException("Milestone not found");
        var scope = scopeService.requireTeamScope(projectId, legacy.getTeamId(), tenantId);
        if (!projectId.equals(scope.projectId())) throw new ResourceNotFoundException("Milestone not found");
        milestoneRepository.attachProjectScope(milestoneId, tenantId, legacy.getTeamId(), projectId);
        return milestoneRepository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
    }

    private Map<UUID, Boolean> validateChecklist(
            com.example.starter_project_2025.system.project.milestone.domain.Milestone milestone,
            Map<UUID, Boolean> requested) {
        Map<UUID, Boolean> result = new LinkedHashMap<>();
        var items = milestone.getChecklistItems();
        var allowed = items.stream().map(item -> item.getId()).collect(java.util.stream.Collectors.toSet());
        if (requested != null && !allowed.containsAll(requested.keySet())) {
            throw new com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException(
                    Map.of("checklist", java.util.List.of("Checklist contains an item outside this milestone")));
        }
        items.forEach(item -> result.put(item.getId(), false));
        return result;
    }

    private ArtifactDraftResponse toResponse(MilestoneArtifactDraft draft) {
        try {
            Map<UUID, Boolean> checklist = objectMapper.readValue(draft.getChecklistJson(), new TypeReference<>() { });
            return new ArtifactDraftResponse(draft.getMilestoneId(), "DRAFT", draft.getRepositoryUrl(),
                    draft.getDeploymentUrl(), draft.getReleaseNotes(), checklist, attachments(draft), draft.getVersion(),
                    draft.getCreatedBy(), draft.getCreatedAt(), draft.getUpdatedBy(), draft.getUpdatedAt());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Stored draft checklist is invalid", ex);
        }
    }

    private String writeChecklist(Map<UUID, Boolean> checklist) {
        try { return objectMapper.writeValueAsString(checklist); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to save checklist", ex); }
    }

    private Map<String, Object> draftDetails(MilestoneArtifactDraft draft) {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("status", "DRAFT");
        details.put("repositoryUrl", draft.getRepositoryUrl());
        details.put("deploymentUrl", draft.getDeploymentUrl());
        details.put("releaseNotes", draft.getReleaseNotes());
        details.put("checklist", draft.getChecklistJson());
        details.put("version", draft.getVersion());
        return details;
    }

    private boolean sameContent(MilestoneArtifactDraft draft, ArtifactDraftRequest request, String checklistJson) {
        return java.util.Objects.equals(draft.getRepositoryUrl(), blankToNull(request.repositoryUrl()))
                && java.util.Objects.equals(draft.getDeploymentUrl(), blankToNull(request.deploymentUrl()))
                && java.util.Objects.equals(draft.getReleaseNotes(), blankToNull(request.releaseNotes()))
                && java.util.Objects.equals(draft.getChecklistJson(), checklistJson);
    }

    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }
    private java.util.List<com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactAttachmentResponse> attachments(MilestoneArtifactDraft draft) {
        return attachmentRepository.findByMilestoneIdAndProjectIdAndTenantIdOrderByUploadedAtAsc(
                        draft.getMilestoneId(), draft.getProjectId(), draft.getTenantId()).stream()
                .map(row -> new com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactAttachmentResponse(
                        row.getId(), row.getOriginalName(), row.getContentType(), row.getSizeBytes(),
                        row.getScanStatus(), row.getUploadedBy(), row.getUploadedAt(), draft.getVersion()))
                .toList();
    }
    private com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactUploadPolicyResponse uploadPolicy() {
        java.util.Set<String> types = ArtifactMimePolicy.parse(uploadAllowedMimeTypes);
        boolean enabled = uploadEnabled && uploadMaxBytes > 0 && clamAvScanner.isConfigured()
                && ArtifactMimePolicy.isSupported(types);
        return new com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactUploadPolicyResponse(
                enabled, uploadMaxBytes, enabled ? types : java.util.Set.of());
    }
    private void validateUrl(String field, String value) {
        if (value == null || value.isBlank()) return;
        try {
            java.net.URI uri = java.net.URI.create(value.trim());
            if (!uri.isAbsolute() || uri.getHost() == null
                    || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException ex) {
            throw new com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException(
                    Map.of(field, java.util.List.of("Must be an absolute HTTP or HTTPS URL")));
        }
    }
    private record Scope(UUID actorId, Long tenantId) { }
}
