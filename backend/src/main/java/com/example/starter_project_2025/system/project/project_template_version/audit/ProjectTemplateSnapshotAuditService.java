package com.example.starter_project_2025.system.project.project_template_version.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionCorrelationIds;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Writes the project template version audit trail inside the same transaction
 * as the business mutation so the two can never diverge.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateSnapshotAuditService {

    ProjectTemplateSnapshotAuditRepository auditRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action,
                       Long snapshotId,
                       Long templateId,
                       Long projectId,
                       Object beforeState,
                       Object afterState) {

        Actor actor = resolveActor();

        ProjectTemplateSnapshotAuditLog auditLog = ProjectTemplateSnapshotAuditLog.builder()
                .snapshotId(snapshotId)
                .templateId(templateId)
                .projectId(projectId)
                .action(action)
                .actorId(actor.id())
                .actorEmail(actor.email())
                .correlationId(ProjectTemplateVersionCorrelationIds.current())
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .build();

        auditRepository.save(auditLog);

        log.info("[PTV-AUDIT] action={} snapshotId={} actorId={} correlationId={}",
                action, snapshotId, actor.id(), auditLog.getCorrelationId());
    }

    @Transactional(readOnly = true)
    public List<ProjectTemplateSnapshotAuditLogDTO> getAuditLogs(Long snapshotId) {
        return auditRepository.findBySnapshotIdOrderByCreatedAtDesc(snapshotId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private ProjectTemplateSnapshotAuditLogDTO toDto(ProjectTemplateSnapshotAuditLog auditLog) {
        return ProjectTemplateSnapshotAuditLogDTO.builder()
                .id(auditLog.getId())
                .snapshotId(auditLog.getSnapshotId())
                .templateId(auditLog.getTemplateId())
                .projectId(auditLog.getProjectId())
                .action(auditLog.getAction())
                .actorId(auditLog.getActorId())
                .actorEmail(auditLog.getActorEmail())
                .correlationId(auditLog.getCorrelationId())
                .beforeState(auditLog.getBeforeState())
                .afterState(auditLog.getAfterState())
                .createdAt(auditLog.getCreatedAt())
                .build();
    }

    private Actor resolveActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return new Actor(null, "SYSTEM");
        }

        Object principal = authentication.getPrincipal();

        if (principal instanceof UserPrincipal userPrincipal && userPrincipal.getUser() != null) {
            return new Actor(userPrincipal.getUser().getId(), userPrincipal.getUsername());
        }

        return new Actor(null, authentication.getName());
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }

        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialise project template version audit state", ex);
            return null;
        }
    }

    private record Actor(Long id, String email) {
    }
}
