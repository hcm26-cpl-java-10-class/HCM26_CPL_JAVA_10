package com.example.starter_project_2025.system.project.sprint_backlog.audit;

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
 * Writes the Sprint Backlog audit trail inside the same transaction as the
 * business mutation so the two can never diverge.
 */
@Slf4j
@Service("backlogItemAuditService")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintBacklogAuditService {

    SprintBacklogAuditRepository auditRepository;
    ObjectMapper objectMapper;
    com.example.starter_project_2025.system.rbac.user.UserRepository userRepository;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action,
                       Long sprintBacklogId,
                       Long sprintId,
                       Object beforeState,
                       Object afterState) {

        Actor actor = resolveActor();
        if (actor.id() != null) userRepository.lockForContribution(List.of(actor.id()));

        SprintBacklogAuditLog auditLog = SprintBacklogAuditLog.builder()
                .sprintBacklogId(sprintBacklogId)
                .sprintId(sprintId)
                .action(action)
                .actorId(actor.id())
                .actorEmail(actor.email())
                .correlationId(SprintCorrelationIds.current())
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .build();

        auditRepository.save(auditLog);

        log.info("[SPRINT-BACKLOG-AUDIT] action={} sprintBacklogId={} actorId={} correlationId={}",
                action, sprintBacklogId, actor.id(), auditLog.getCorrelationId());
    }

    @Transactional(readOnly = true)
    public List<SprintBacklogAuditLogDTO> getAuditLogs(Long sprintBacklogId) {
        return auditRepository.findBySprintBacklogIdOrderByCreatedAtDesc(sprintBacklogId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private SprintBacklogAuditLogDTO toDto(SprintBacklogAuditLog auditLog) {
        return SprintBacklogAuditLogDTO.builder()
                .id(auditLog.getId())
                .sprintBacklogId(auditLog.getSprintBacklogId())
                .sprintId(auditLog.getSprintId())
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
            log.warn("Unable to serialise sprint backlog audit state", ex);
            return null;
        }
    }

    private record Actor(Long id, String email) {
    }
}
