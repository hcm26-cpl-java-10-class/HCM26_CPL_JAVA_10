package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRecord;
import com.example.starter_project_2025.system.project.milestone.idempotency.IdempotencyRepository;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneQueryService;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactDraft;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactSubmission;
import com.example.starter_project_2025.system.project.milestone.submission.dto.*;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
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

/** Team-scoped counterpart of the Project artifact workflow. Uploaded files stay disabled until team storage policy is configured. */
@Service
@RequiredArgsConstructor
public class TeamArtifactSubmissionService {
    private static final String OPERATION = "TEAM_ARTIFACT_SUBMISSION";
    private final CurrentActorProvider actorProvider;
    private final MilestoneTenantProvider tenantProvider;
    private final ArtifactSubmissionScopePort scopePort;
    private final MilestoneRepository milestoneRepository;
    private final MilestoneQueryService milestoneQueryService;
    private final MilestoneArtifactDraftRepository draftRepository;
    private final MilestoneArtifactSubmissionRepository submissionRepository;
    private final ArtifactAttachmentRepository attachmentRepository;
    private final IdempotencyRepository idempotencyRepository;
    private final MilestoneAuditRepository auditRepository;
    private final OutboxEventWriter outboxWriter;
    private final ObjectMapper objectMapper;
    private final com.example.starter_project_2025.system.rbac.user.UserRepository userRepository;

    @Transactional(readOnly = true)
    public ArtifactSubmissionWorkspaceResponse workspace(Long teamId, UUID milestoneId) {
        Scope s = studentScope(teamId);
        var milestone = milestoneRepository.findByIdAndTeamIdAndTenantId(milestoneId, teamId, s.tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        var draft = draftRepository.findByMilestoneIdAndTeamIdAndTenantId(milestoneId, teamId, s.tenantId)
                .map(row -> draftResponse(row, teamId)).orElse(null);
        var latest = submissionRepository.findTopByTenantIdAndTeamIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(
                s.tenantId, teamId, milestoneId, s.actorId).map(this::submissionResponse).orElse(null);
        return new ArtifactSubmissionWorkspaceResponse(milestoneQueryService.getTeamDetail(teamId, milestoneId), draft,
                new ArtifactUploadPolicyResponse(false, 0, Set.of()), latest);
    }

    @Transactional
    public ArtifactDraftResponse save(Long teamId, UUID milestoneId, ArtifactDraftRequest request) {
        Scope s = studentScope(teamId);
        var milestone = milestoneRepository.findByIdAndTeamIdAndTenantId(milestoneId, teamId, s.tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        validateUrl("repositoryUrl", request.repositoryUrl()); validateUrl("deploymentUrl", request.deploymentUrl());
        Map<UUID, Boolean> checklist = validateChecklist(milestone, request.checklist());
        String json = write(checklist); Instant now = Instant.now();
        var existing = draftRepository.findByMilestoneIdAndTeamIdAndTenantId(milestoneId, teamId, s.tenantId);
        boolean creating = existing.isEmpty();
        var draft = existing.orElseGet(() -> MilestoneArtifactDraft.create(milestoneId, null, teamId,
                s.tenantId, s.actorId, now, json));
        boolean same = Objects.equals(draft.getRepositoryUrl(), blank(request.repositoryUrl()))
                && Objects.equals(draft.getDeploymentUrl(), blank(request.deploymentUrl()))
                && Objects.equals(draft.getReleaseNotes(), blank(request.releaseNotes()))
                && Objects.equals(draft.getChecklistJson(), json);
        if (!creating && request.expectedVersion() == null && !same) throw new MilestoneConflictException("Draft version is required. Reload before saving.");
        if (request.expectedVersion() != null && request.expectedVersion() != draft.getVersion() && !same) throw new MilestoneConflictException("Draft changed in another session. Reload before saving.");
        if (!creating && same) return draftResponse(draft, teamId);
        draft.update(s.actorId, now, blank(request.repositoryUrl()), blank(request.deploymentUrl()), blank(request.releaseNotes()), json);
        draft = draftRepository.saveAndFlush(draft);
        try {
            auditRepository.save(MilestoneAuditLog.artifactDraftSaved(milestoneId, null, s.tenantId, s.actorId,
                    CorrelationIdFilter.currentId(), objectMapper.writeValueAsString(Map.of("status", "DRAFT", "version", draft.getVersion())), now));
            outboxWriter.writeArtifactDraftSaved(milestoneId, null, s.tenantId, s.actorId, draft.getVersion(), now);
        } catch (JsonProcessingException e) { throw new IllegalStateException("Unable to record team artifact draft", e); }
        return draftResponse(draft, teamId);
    }

    @Transactional
    public ArtifactSubmissionResponse submit(Long teamId, UUID milestoneId, String key, ArtifactSubmissionRequest request) {
        Scope s = studentScope(teamId);
        if (key == null || key.isBlank() || key.length() > 100) throw validation("idempotencyKey", "Idempotency-Key is required");
        var milestone = milestoneRepository.lockForTeamSubmission(milestoneId, teamId, s.tenantId)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        String hash = hash(teamId, milestoneId, s.actorId, request);
        var prior = idempotencyRepository.findByTenantIdAndActorIdAndOperationAndIdempotencyKey(s.tenantId, s.actorId, OPERATION, key);
        if (prior.isPresent()) {
            if (!prior.get().getRequestHash().equals(hash)) throw new MilestoneConflictException("Idempotency-Key already used for another request");
            return submissionRepository.findById(prior.get().getResourceId()).map(this::submissionResponse)
                    .orElseThrow(() -> new IllegalStateException("Idempotent team submission is missing"));
        }
        validateUrl("repositoryUrl", request.repositoryUrl()); validateUrl("deploymentUrl", request.deploymentUrl());
        Map<UUID, Boolean> checklist = validateChecklist(milestone, request.checklist());
        if (request.attachmentIds() != null && !request.attachmentIds().isEmpty()) throw validation("attachments", "Team milestone file upload is not configured");
        if (blank(request.repositoryUrl()) == null && blank(request.deploymentUrl()) == null) throw validation("artifact", "Provide a repository URL or deployment URL");
        Instant now = Instant.now(); boolean late = now.isAfter(milestone.getDeadline());
        if (late && (milestone.getLatePolicyType() != LatePolicyType.ALLOW_LATE || milestone.getLateUntil() == null || now.isAfter(milestone.getLateUntil())))
            throw validation("deadline", "The late policy does not accept submissions now");
        var previous = submissionRepository.findTopByTenantIdAndTeamIdAndMilestoneIdAndSubmitterIdOrderByVersionDesc(s.tenantId, teamId, milestoneId, s.actorId);
        long version = previous.map(row -> row.getVersion() + 1).orElse(1L);
        String checklistJson = write(checklist);
        var row = submissionRepository.saveAndFlush(MilestoneArtifactSubmission.submit(s.tenantId, null, teamId,
                milestoneId, s.actorId, version, blank(request.repositoryUrl()), blank(request.deploymentUrl()),
                blank(request.releaseNotes()), checklistJson, "[]", now, late, late ? milestone.getLatePenaltyPercent() : null));
        var response = submissionResponse(row);
        try {
            auditRepository.save(MilestoneAuditLog.artifactEvent(milestoneId, null, s.tenantId, s.actorId,
                    "ARTIFACT_SUBMITTED", CorrelationIdFilter.currentId(), objectMapper.writeValueAsString(response), now));
        } catch (JsonProcessingException e) { throw new IllegalStateException("Unable to record team artifact submission", e); }
        outboxWriter.writeArtifactSubmitted(row.getId(), milestoneId, null, s.tenantId, s.actorId, version, late, now);
        idempotencyRepository.save(IdempotencyRecord.completed(s.tenantId, s.actorId, OPERATION, key, hash, row.getId(), 201, now));
        return response;
    }

    @Transactional(readOnly = true)
    public List<TeamSubmissionView> submissions(Long teamId, UUID milestoneId) {
        Scope s = reviewerScope(teamId);
        var rows = milestoneId == null ? submissionRepository.findByTenantIdAndTeamIdOrderBySubmittedAtDesc(s.tenantId, teamId)
                : submissionRepository.findByTenantIdAndTeamIdAndMilestoneIdOrderBySubmittedAtDesc(s.tenantId, teamId, milestoneId);
        Map<UUID, com.example.starter_project_2025.system.rbac.user.User> actors = new HashMap<>();
        userRepository.findByTenantIdAndIsActiveTrue(s.tenantId).forEach(user -> {
            UUID id = UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)); actors.put(id, user);
        });
        return rows.stream().map(row -> {
            var user = actors.get(row.getSubmitterId());
            String name = user == null ? null : (Objects.toString(user.getFirstName(), "") + " " + Objects.toString(user.getLastName(), "")).trim();
            return new TeamSubmissionView(submissionResponse(row), row.getSubmitterId(), name, user == null ? null : user.getEmail());
        }).toList();
    }

    private Scope studentScope(Long teamId) {
        UUID actor = actorProvider.requireCurrentActorId(); Long tenant = tenantProvider.requireCurrentTenantId();
        scopePort.requireStudentTeamAccess(teamId, actor, tenant); return new Scope(actor, tenant);
    }
    private Scope reviewerScope(Long teamId) {
        UUID actor = actorProvider.requireCurrentActorId(); Long tenant = tenantProvider.requireCurrentTenantId();
        if (!milestoneRepository.existsByTeamIdAndTenantIdAndActiveTrue(teamId, tenant)) throw new ResourceNotFoundException("Team milestone not found");
        return new Scope(actor, tenant);
    }
    private Map<UUID, Boolean> validateChecklist(com.example.starter_project_2025.system.project.milestone.domain.Milestone m, Map<UUID, Boolean> requested) {
        var allowed = m.getChecklistItems().stream().map(x -> x.getId()).collect(java.util.stream.Collectors.toSet());
        if (requested != null && !allowed.containsAll(requested.keySet())) throw validation("checklist", "Checklist contains an item outside this milestone");
        Map<UUID, Boolean> result = new LinkedHashMap<>(); m.getChecklistItems().forEach(x -> result.put(x.getId(), requested != null && Boolean.TRUE.equals(requested.get(x.getId())))); return result;
    }
    private ArtifactDraftResponse draftResponse(MilestoneArtifactDraft d, Long teamId) {
        try { return new ArtifactDraftResponse(d.getMilestoneId(), "DRAFT", d.getRepositoryUrl(), d.getDeploymentUrl(), d.getReleaseNotes(), objectMapper.readValue(d.getChecklistJson(), new TypeReference<>() {}), attachmentRepository.findByMilestoneIdAndTeamIdAndTenantIdOrderByUploadedAtAsc(d.getMilestoneId(), teamId, d.getTenantId()).stream().map(a -> new ArtifactAttachmentResponse(a.getId(), a.getOriginalName(), a.getContentType(), a.getSizeBytes(), a.getScanStatus(), a.getUploadedBy(), a.getUploadedAt(), d.getVersion())).toList(), d.getVersion(), d.getCreatedBy(), d.getCreatedAt(), d.getUpdatedBy(), d.getUpdatedAt()); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid team draft checklist", e); }
    }
    private ArtifactSubmissionResponse submissionResponse(MilestoneArtifactSubmission row) {
        try { return new ArtifactSubmissionResponse(row.getId(), row.getMilestoneId(), row.getVersion(), row.getStatus().name(), row.getRepositoryUrl(), row.getDeploymentUrl(), row.getReleaseNotes(), objectMapper.readValue(row.getChecklistJson(), new TypeReference<>() {}), objectMapper.readValue(row.getAttachmentsJson(), new TypeReference<>() {}), row.getSubmittedAt(), row.isSubmittedLate(), row.getLatePenaltyPercent()); }
        catch (JsonProcessingException e) { throw new IllegalStateException("Invalid stored team submission", e); }
    }
    private void validateUrl(String field, String value) { if (blank(value) == null) return; try { var u = java.net.URI.create(value.trim()); if (!u.isAbsolute() || u.getHost() == null || !(u.getScheme().equalsIgnoreCase("http") || u.getScheme().equalsIgnoreCase("https"))) throw new IllegalArgumentException(); } catch (RuntimeException e) { throw validation(field, "Enter a valid absolute HTTP or HTTPS URL"); } }
    private String write(Object value) { try { return objectMapper.writeValueAsString(value); } catch (JsonProcessingException e) { throw new IllegalStateException(e); } }
    private String hash(Long team, UUID milestone, UUID actor, Object request) { try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((team+"|"+milestone+"|"+actor+"|"+objectMapper.writeValueAsString(request)).getBytes(StandardCharsets.UTF_8))); } catch (Exception e) { throw new IllegalStateException(e); } }
    private MilestoneValidationException validation(String f, String m) { return new MilestoneValidationException(Map.of(f, List.of(m))); }
    private String blank(String s) { return s == null || s.isBlank() ? null : s.trim(); }
    private record Scope(UUID actorId, Long tenantId) { }
    public record TeamSubmissionView(ArtifactSubmissionResponse submission, UUID submitterId, String submitterName, String submitterEmail) { }
}
