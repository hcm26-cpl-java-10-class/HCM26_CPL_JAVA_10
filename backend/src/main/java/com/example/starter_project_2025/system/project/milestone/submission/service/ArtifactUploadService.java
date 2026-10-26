package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentTenantProvider;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.service.MilestoneAccessPolicy;
import com.example.starter_project_2025.system.project.milestone.submission.domain.ArtifactAttachment;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneArtifactDraft;
import com.example.starter_project_2025.system.project.milestone.submission.dto.ArtifactAttachmentResponse;
import com.example.starter_project_2025.system.project.milestone.submission.repository.ArtifactAttachmentRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneArtifactDraftRepository;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ArtifactUploadService {
    private final CurrentActorProvider actorProvider;
    private final CurrentTenantProvider tenantProvider;
    private final ProjectMilestonePort projectPort;
    private final ArtifactSubmissionScopePort submissionScope;
    private final MilestoneAccessPolicy accessPolicy;
    private final MilestoneRepository milestoneRepository;
    private final MilestoneArtifactDraftRepository draftRepository;
    private final ArtifactAttachmentRepository attachmentRepository;
    private final MilestoneAuditRepository auditRepository;
    private final OutboxEventWriter outboxWriter;
    private final ClamAvScanner scanner;
    private final ObjectMapper objectMapper;

    @Value("${app.artifact.upload.enabled:false}") private boolean enabled;
    @Value("${app.artifact.upload.max-bytes:0}") private long maxBytes;
    @Value("${app.artifact.upload.allowed-mime-types:}") private String allowedMimeTypes;
    @Value("${app.artifact.upload.storage-path:./data/artifact-uploads}") private String storagePath;

    @Transactional
    public ArtifactAttachmentResponse upload(UUID projectId, UUID milestoneId, MultipartFile file) {
        UUID actorId = actorProvider.requireCurrentActorId();
        UUID tenantId = tenantProvider.requireCurrentTenantId();
        ProjectReadContext project = projectPort.requireProjectForRead(projectId, actorId, tenantId);
        accessPolicy.requireReadAccess(project);
        submissionScope.requireStudentProjectAccess(projectId, actorId, tenantId);
        var milestone = milestoneRepository.findByIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId)
                .filter(com.example.starter_project_2025.system.project.milestone.domain.Milestone::isActive)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone not found"));
        Set<String> allowlist = ArtifactMimePolicy.parse(allowedMimeTypes);
        if (!enabled || maxBytes <= 0 || !ArtifactMimePolicy.isSupported(allowlist)) {
            throw new ArtifactUploadUnavailableException("Artifact upload policy is not configured");
        }
        if (file == null || file.isEmpty()) throw rejected("file", "Choose a non-empty file");
        if (file.getSize() > maxBytes) throw rejected("file", "File exceeds the configured size limit");
        byte[] bytes;
        try { bytes = file.getBytes(); }
        catch (IOException ex) { throw new ArtifactUploadUnavailableException("Could not read uploaded file", ex); }
        String detectedType = detectMimeType(bytes);
        if (!allowlist.contains(detectedType)) throw rejected("file", "This file type is not allowed by the upload policy");
        String declaredType = file.getContentType();
        if (declaredType != null && !declaredType.isBlank()
                && !"application/octet-stream".equalsIgnoreCase(declaredType)
                && !detectedType.equalsIgnoreCase(declaredType.trim())) {
            throw rejected("file", "Declared file type does not match the file content");
        }
        scanner.requireClean(bytes);

        Instant now = Instant.now();
        var existingDraft = draftRepository.findByMilestoneIdAndProjectIdAndTenantId(milestoneId, projectId, tenantId);
        MilestoneArtifactDraft draft = existingDraft.orElseGet(() -> MilestoneArtifactDraft.create(
                milestoneId, projectId, tenantId, actorId, now, "{}"));
        if (existingDraft.isEmpty()) draftRepository.saveAndFlush(draft);

        UUID storageKey = UUID.randomUUID();
        Path root = Path.of(storagePath).toAbsolutePath().normalize();
        Path destination = root.resolve(storageKey + ".blob").normalize();
        if (!destination.startsWith(root)) throw new ArtifactUploadUnavailableException("Invalid storage configuration");
        try {
            Files.createDirectories(root);
            Files.write(destination, bytes);
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override public void afterCompletion(int status) {
                        if (status != STATUS_COMMITTED) {
                            try { Files.deleteIfExists(destination); } catch (IOException ignored) { }
                        }
                    }
                });
            }
        } catch (IOException ex) {
            try { Files.deleteIfExists(destination); } catch (IOException ignored) { }
            throw new ArtifactUploadUnavailableException("Could not store uploaded file", ex);
        }

        String name = safeFileName(file.getOriginalFilename());
        ArtifactAttachment attachment = attachmentRepository.saveAndFlush(ArtifactAttachment.clean(
                milestoneId, projectId, tenantId, storageKey.toString(), name, detectedType,
                bytes.length, actorId, now));
        try {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("attachmentId", attachment.getId());
            details.put("fileName", name);
            details.put("contentType", detectedType);
            details.put("sizeBytes", bytes.length);
            details.put("scanStatus", "CLEAN");
            auditRepository.save(MilestoneAuditLog.artifactEvent(milestoneId, projectId, tenantId, actorId,
                    "ARTIFACT_FILE_UPLOADED", CorrelationIdFilter.currentId(),
                    objectMapper.writeValueAsString(details), now));
            outboxWriter.writeArtifactFileUploaded(milestoneId, projectId, tenantId, actorId,
                    attachment.getId(), now);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Unable to serialize artifact upload audit", ex);
        }
        return new ArtifactAttachmentResponse(attachment.getId(), attachment.getOriginalName(),
                attachment.getContentType(), attachment.getSizeBytes(), attachment.getScanStatus(),
                attachment.getUploadedBy(), attachment.getUploadedAt(), draft.getVersion());
    }

    private String detectMimeType(byte[] bytes) {
        if (startsWith(bytes, new byte[]{'%', 'P', 'D', 'F', '-'})) return "application/pdf";
        if (startsWith(bytes, new byte[]{'P', 'K', 3, 4}) || startsWith(bytes, new byte[]{'P', 'K', 5, 6})) return "application/zip";
        if (startsWith(bytes, new byte[]{(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10})) return "image/png";
        if (startsWith(bytes, new byte[]{(byte) 0xff, (byte) 0xd8, (byte) 0xff})) return "image/jpeg";
        try {
            String text = StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(bytes)).toString();
            if (text.indexOf('\0') < 0 && text.codePoints().noneMatch(code -> Character.isISOControl(code)
                    && code != '\n' && code != '\r' && code != '\t')) return "text/plain";
        } catch (CharacterCodingException ignored) { }
        throw rejected("file", "The file type could not be verified");
    }

    private boolean startsWith(byte[] bytes, byte[] signature) {
        if (bytes.length < signature.length) return false;
        for (int i = 0; i < signature.length; i++) if (bytes[i] != signature[i]) return false;
        return true;
    }

    private String safeFileName(String original) {
        String value = original == null ? "artifact" : original.replace('\\', '/');
        value = value.substring(value.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "_").trim();
        if (value.isBlank()) value = "artifact";
        return value.length() <= 255 ? value : value.substring(value.length() - 255);
    }

    private MilestoneValidationException rejected(String field, String message) {
        return new MilestoneValidationException(Map.of(field, java.util.List.of(message)));
    }
}
