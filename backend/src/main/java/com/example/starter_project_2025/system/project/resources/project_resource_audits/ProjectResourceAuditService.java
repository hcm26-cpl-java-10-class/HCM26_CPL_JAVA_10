package com.example.starter_project_2025.system.project.resources.project_resource_audits;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Writes the project resource audit trail inside the same transaction as the
 * business mutation so the two can never diverge (US-RES-003 business rule 3).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectResourceAuditService {

    ProjectResourceAuditRepository audits;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void record(String action,
                       Long projectId,
                       Long resourceId,
                       Object beforeState,
                       Object afterState) {

        Actor actor = resolveActor();

        ProjectResourceAuditLog audit = ProjectResourceAuditLog.builder()
                .projectId(projectId)
                .resourceId(resourceId)
                .action(action)
                .actorId(actor.id())
                .actorEmail(actor.email())
                .correlationId(correlationId())
                .beforeState(toJson(beforeState))
                .afterState(toJson(afterState))
                .build();

        audits.save(audit);

        log.info("[PROJECT-RESOURCE-AUDIT] action={} projectId={} resourceId={} actorId={}",
                action, projectId, resourceId, actor.id());
    }

    private String correlationId() {

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        return correlationId == null || correlationId.isBlank()
                ? UUID.randomUUID().toString()
                : correlationId;
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
            log.warn("Unable to serialise project resource audit state", ex);
            return null;
        }
    }

    private record Actor(Long id, String email) {
    }
}
