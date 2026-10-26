package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRecord;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRepository;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneAccessPolicy;
import com.example.starter_project_2025.system.project.milestone.submission.domain.ArtifactAttachment;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionAttachmentResponse;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionRequest;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactSubmissionResponse;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ArtifactAttachmentRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactDraftRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ArtifactSubmissionService {
    private static final String OPERATION = "ARTIFACT_SUBMISSION";

    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final ArtifactSubmissionScopePort submissionScope;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository milestoneRepository;
    private final ArtifactAttachmentRepository attachmentRepository;
    private final MilestoneArtifactSubmissionRepository submissionRepository;
    private final MilestoneArtifactDraftRepository draftRepository;
    private final IdempotencyRepository idempotencyRepository;
    private final MilestoneAuditRepository auditRepository;
    private final OutboxEventWriter outboxWriter;
    private final ObjectMapper objectMapper;

    @Transactional
    public ArtifactSubmissionResponse submit(UUID projectId, UUID milestoneId, String idempotencyKey,
            ArtifactSubmissionRequest request) {
        Scope scope = requireScope(projectId);
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 100) {
            throw validation("idempotencyKey", "Idempotency-Key is required and must not exceed 100 characters");
        }

        // Serialize submissions for this milestone across application instances. A retry then sees
        // the committed idempotency record and returns the original immutable submission.
        Milestone milestone = milestoneRepository.lockForSubmission(milestoneId, projectId, scope.tenantId())
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        String requestHash = hash(projectId, milestoneId, scope.actorId(), request);
        var previous = idempotencyRepository.findByTenantIdAndActorIdAndOperationAndIdempotencyKey(
                scope.tenantId(), scope.actorId(), OPERATION, idempotencyKey);
        if (previous.isPresent()) {
            if (!previous.get().getRequestHash().equals(requestHash)) {
                throw new MilestoneConflictException("This Idempotency-Key was already used for a different submission");
            }
            UUID resourceId = previous.get().getResourceId();
            return submissionRepository.findById(resourceId).map(this::toResponse)
                    .orElseThrow(() -> new IllegalStateException("Idempotent submission record is missing"));
        }

        validateUrl("repositoryUrl", request.repositoryUrl());
        validateUrl("deploymentUrl", request.deploymentUrl());
        Map<UUID, Boolean> checklist = validateChecklist(milestone, request.checklist());
        List<ArtifactAttachment> attachments = validateAttachments(
                request.attachmentIds(), milestoneId, projectId, scope);
        if (blank(request.repositoryUrl()) && blank(request.deploymentUrl()) && attachments.isEmpty()) {
            throw validation("artifact", "Provide at least one valid repository URL, deployment URL, or uploaded attachment");
        }

        Instant now = Instant.now();
        boolean late = now.isAfter(milestone.getDeadline());
        if (late && (milestone.getLatePolicyType() != LatePolicyType.ALLOW_LATE
                || milestone.getLateUntil() == null || now.isAfter(milestone.getLateUntil()))) {
            throw validation("deadline", "The milestone deadline has passed and its late policy does not accept submissions now");
        }

        long version = submissionRepository.findTopByTenantIdAndProjectIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
                scope.tenantId(), projectId, milestoneId, scope.actorId()).map(row -> row.getVersion() + 1).orElse(1L);
        String checklistJson = writeJson(checklist);
        List<ArtifactSubmissionAttachmentResponse> attachmentSnapshots = attachments.stream()
                .map(this::attachmentResponse).toList();
        String attachmentsJson = writeJson(attachmentSnapshots);
        MilestoneArtifactSubmission submission = submissionRepository.saveAndFlush(MilestoneArtifactSubmission.submit(
                scope.tenantId(), projectId, milestoneId, scope.actorId(), version,
                normalize(request.repositoryUrl()), normalize(request.deploymentUrl()),
                normalize(request.releaseNotes()), checklistJson, attachmentsJson, now, late,
                late ? milestone.getLatePenaltyPercent() : null));
        ArtifactSubmissionResponse response = toResponse(submission);

        try {
            Map<String, Object> before = draftRepository
                    .findByMilestoneIdAndProjectIdAndTenantId(milestoneId, projectId, scope.tenantId())
                    .map(draft -> {
                        Map<String, Object> snapshot = new LinkedHashMap<>();
                        snapshot.put("status", "DRAFT");
                        snapshot.put("version", draft.getVersion());
                        snapshot.put("repositoryUrl", draft.getRepositoryUrl());
                        snapshot.put("deploymentUrl", draft.getDeploymentUrl());
                        snapshot.put("releaseNotes", draft.getReleaseNotes());
                        snapshot.put("checklist", draft.getChecklistJson());
                        return snapshot;
                    }).orElseGet(() -> Map.of("status", "NO_DRAFT"));
            Map<String, Object> auditDetails = new LinkedHashMap<>();
            auditDetails.put("before", before);
            auditDetails.put("after", response);
            auditRepository.save(MilestoneAuditLog.artifactEvent(milestoneId, projectId, scope.tenantId(),
                    scope.actorId(), "ARTIFACT_SUBMITTED", CorrelationIdFilter.currentId(),
                    objectMapper.writeValueAsString(auditDetails), now));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact submission audit", ex);
        }
        outboxWriter.writeArtifactSubmitted(submission.getId(), milestoneId, projectId,
                scope.tenantId(), scope.actorId(), version, late, now);
        idempotencyRepository.save(IdempotencyRecord.completed(scope.tenantId(), scope.actorId(),
                OPERATION, idempotencyKey, requestHash, submission.getId(), 201, now));
        return response;
    }

    private Scope requireScope(UUID projectId) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);
        submissionScope.requireStudentProjectAccess(projectId, actorId, tenantId);
        return new Scope(actorId, tenantId);
    }

    private List<ArtifactAttachment> validateAttachments(List<UUID> ids, UUID milestoneId,
            UUID projectId, Scope scope) {
        if (ids == null || ids.isEmpty()) return List.of();
        if (ids.stream().anyMatch(Objects::isNull) || new HashSet<>(ids).size() != ids.size()) {
            throw validation("attachmentIds", "Attachment list contains an invalid or duplicate file");
        }
        List<ArtifactAttachment> rows = attachmentRepository
                .findByIdInAndMilestoneIdAndProjectIdAndTenantIdAndUploadedByAndScanStatus(
                        ids, milestoneId, projectId, scope.tenantId(), scope.actorId(), "CLEAN");
        if (rows.size() != ids.size()) {
            throw validation("attachments", "One or more files are unavailable, rejected, or outside your submission scope");
        }
        Map<UUID, ArtifactAttachment> byId = new HashMap<>();
        rows.forEach(row -> byId.put(row.getId(), row));
        return ids.stream().map(byId::get).toList();
    }

    private Map<UUID, Boolean> validateChecklist(Milestone milestone, Map<UUID, Boolean> requested) {
        Map<UUID, Boolean> result = new LinkedHashMap<>();
        Set<UUID> allowed = milestone.getChecklistItems().stream().map(item -> item.getId())
                .collect(java.util.stream.Collectors.toSet());
        if (requested != null && !allowed.containsAll(requested.keySet())) {
            throw validation("checklist", "Checklist contains an item outside this milestone");
        }
        milestone.getChecklistItems().forEach(item -> result.put(item.getId(),
                requested != null && Boolean.TRUE.equals(requested.get(item.getId()))));
        return result;
    }

    private void validateUrl(String field, String value) {
        if (blank(value)) return;
        try {
            java.net.URI uri = java.net.URI.create(value.trim());
            if (!uri.isAbsolute() || uri.getHost() == null
                    || !("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme()))) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException ex) {
            throw validation(field, "Enter a valid absolute HTTP or HTTPS URL");
        }
    }

    public ArtifactSubmissionResponse toResponse(MilestoneArtifactSubmission row) {
        try {
            Map<UUID, Boolean> checklist = objectMapper.readValue(row.getChecklistJson(), new TypeReference<>() { });
            List<ArtifactSubmissionAttachmentResponse> attachments = objectMapper.readValue(
                    row.getAttachmentsJson(), new TypeReference<>() { });
            return new ArtifactSubmissionResponse(row.getId(), row.getMilestoneId(), row.getVersion(),
                    row.getStatus().name(), row.getRepositoryUrl(), row.getDeploymentUrl(), row.getReleaseNotes(),
                    checklist, attachments, row.getSubmittedAt(), row.isSubmittedLate(), row.getLatePenaltyPercent());
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Stored artifact submission snapshot is invalid", ex);
        }
    }

    private ArtifactSubmissionAttachmentResponse attachmentResponse(ArtifactAttachment row) {
        return new ArtifactSubmissionAttachmentResponse(row.getId(), row.getOriginalName(),
                row.getContentType(), row.getSizeBytes());
    }

    private String hash(UUID projectId, UUID milestoneId, UUID actorId, ArtifactSubmissionRequest request) {
        try {
            String canonical = "SUBMIT_ARTIFACT|" + projectId + "|" + milestoneId + "|" + actorId + "|"
                    + objectMapper.writeValueAsString(request);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(canonical.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to calculate artifact submission request hash", ex);
        }
    }

    private String writeJson(Object value) {
        try { return objectMapper.writeValueAsString(value); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Unable to serialize artifact submission", ex); }
    }

    private MilestoneValidationException validation(String field, String message) {
        return new MilestoneValidationException(Map.of(field, List.of(message)));
    }

    private String normalize(String value) { return blank(value) ? null : value.trim(); }
    private boolean blank(String value) { return value == null || value.isBlank(); }
    private record Scope(UUID actorId, UUID tenantId) { }
}
