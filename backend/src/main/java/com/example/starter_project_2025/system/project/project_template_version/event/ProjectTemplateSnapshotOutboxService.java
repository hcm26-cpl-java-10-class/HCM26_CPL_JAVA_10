package com.example.starter_project_2025.system.project.project_template_version.event;

import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateVersionCorrelationIds;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Appends project template version domain events to the transactional outbox.
 * <p>
 * Rows are written in the same transaction as the snapshot mutation, so either
 * both the business data and the event exist, or neither does. Duplicate
 * emissions for the same aggregate/action/correlation triple are ignored,
 * making publishing idempotent.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateSnapshotOutboxService {

    public static final String AGGREGATE_TYPE = "PROJECT_TEMPLATE_VERSION";

    ProjectTemplateSnapshotOutboxRepository outboxRepository;
    ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void enqueue(String eventType,
                        Long snapshotId,
                        Long templateId,
                        Long projectId,
                        String actorEmail,
                        Object payload) {

        String correlationId = ProjectTemplateVersionCorrelationIds.current();

        String dedupeKey = String.join(":",
                AGGREGATE_TYPE,
                String.valueOf(snapshotId),
                eventType,
                correlationId);

        if (outboxRepository.existsByDedupeKey(dedupeKey)) {
            log.debug("[PTV-OUTBOX] duplicate event ignored: {}", dedupeKey);
            return;
        }

        ProjectTemplateSnapshotOutboxEvent event = ProjectTemplateSnapshotOutboxEvent.builder()
                .eventId(UUID.randomUUID().toString())
                .dedupeKey(dedupeKey)
                .aggregateType(AGGREGATE_TYPE)
                .aggregateId(snapshotId)
                .eventType(eventType)
                .correlationId(correlationId)
                .payload(toJson(ProjectTemplateSnapshotNotificationPayload.of(
                        eventType, snapshotId, templateId, projectId, actorEmail, payload
                )))
                .status(ProjectTemplateSnapshotOutboxStatus.PENDING)
                .build();

        outboxRepository.save(event);

        log.info("[PTV-OUTBOX] event queued type={} snapshotId={} correlationId={}",
                eventType, snapshotId, correlationId);
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(
                    "Unable to serialise project template version outbox payload", ex);
        }
    }

    /**
     * Payload delivered to the notification pipeline (team members).
     */
    record ProjectTemplateSnapshotNotificationPayload(
            String eventType,
            Long snapshotId,
            Long templateId,
            Long projectId,
            String actorEmail,
            String channel,
            LocalDateTime occurredAt,
            Object data
    ) {
        static ProjectTemplateSnapshotNotificationPayload of(String eventType,
                                                             Long snapshotId,
                                                             Long templateId,
                                                             Long projectId,
                                                             String actorEmail,
                                                             Object data) {
            return new ProjectTemplateSnapshotNotificationPayload(
                    eventType,
                    snapshotId,
                    templateId,
                    projectId,
                    actorEmail,
                    "TEAM_MEMBERS",
                    LocalDateTime.now(),
                    data
            );
        }
    }
}
