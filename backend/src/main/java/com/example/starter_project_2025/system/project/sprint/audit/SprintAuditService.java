package com.example.starter_project_2025.system.project.sprint.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.sprint.SprintCorrelationIds;
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
 * Writes the sprint audit trail inside the same transaction as the business
 * mutation so the two can never diverge.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintAuditService {

    SprintAuditRepository auditRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action,
                       Long sprintId,
                       Long projectId,
                       Object beforeState,
                       Object afterState) {

        Actor actor = resolveActor();

        SprintAuditLog auditLog = SprintAuditLog.builder()
                .sprintId(sprintId)
                .projectId(projectId)
                .action(action)
                .actorId(actor.id())
                .actorEmail(actor.email())
                .correlationId(SprintCorrelationIds.current())
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .build();

        auditRepository.save(auditLog);

        log.info("[SPRINT-AUDIT] action={} sprintId={} actorId={} correlationId={}",
                action, sprintId, actor.id(), auditLog.getCorrelationId());
    }

    @Transactional(readOnly = true)
    public List<SprintAuditLogDTO> getAuditLogs(Long sprintId) {
        return auditRepository.findBySprintIdOrderByCreatedAtDesc(sprintId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private SprintAuditLogDTO toDto(SprintAuditLog log) {
        return SprintAuditLogDTO.builder()
                .id(log.getId())
                .sprintId(log.getSprintId())
                .projectId(log.getProjectId())
                .action(log.getAction())
                .actorId(log.getActorId())
                .actorEmail(log.getActorEmail())
                .correlationId(log.getCorrelationId())
                .beforeState(log.getBeforeState())
                .afterState(log.getAfterState())
                .createdAt(log.getCreatedAt())
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
            log.warn("Unable to serialise sprint audit state", ex);
            return null;
        }
    }

    private record Actor(Long id, String email) {
    }
}
