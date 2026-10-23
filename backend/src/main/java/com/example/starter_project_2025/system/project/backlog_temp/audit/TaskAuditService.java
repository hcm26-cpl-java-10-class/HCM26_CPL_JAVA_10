package com.example.starter_project_2025.system.project.backlog_temp.audit;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.backlog_temp.TaskCorrelationIds;
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
 * Writes the backlog item audit trail inside the same transaction as the
 * business mutation so the two can never diverge
 * (UFR-PRJ-003-02, "thay đổi thông tin đều được ghi log").
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskAuditService {

    TaskAuditRepository auditRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action,
                       Long taskId,
                       Long projectId,
                       Object beforeState,
                       Object afterState) {

        Actor actor = resolveActor();

        TaskAuditLog auditLog = TaskAuditLog.builder()
                .taskId(taskId)
                .projectId(projectId)
                .action(action)
                .actorId(actor.id())
                .actorEmail(actor.email())
                .correlationId(TaskCorrelationIds.current())
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .build();

        auditRepository.save(auditLog);

        log.info("[TASK-AUDIT] action={} taskId={} actorId={} correlationId={}",
                action, taskId, actor.id(), auditLog.getCorrelationId());
    }

    @Transactional(readOnly = true)
    public List<TaskAuditLogDTO> getAuditLogs(Long taskId) {

        return auditRepository.findByTaskIdOrderByCreatedAtDesc(taskId)
                .stream()
                .map(this::toDto)
                .toList();
    }

    private TaskAuditLogDTO toDto(TaskAuditLog auditLog) {

        return TaskAuditLogDTO.builder()
                .id(auditLog.getId())
                .taskId(auditLog.getTaskId())
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
            log.warn("Unable to serialise backlog item audit state", ex);
            return null;
        }
    }

    private record Actor(Long id, String email) {
    }
}
