package com.example.starter_project_2025.system.project.project_template_version.event;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Relays pending project template version outbox rows exactly once. In this
 * starter project the event is "delivered" to the application log (the
 * notification adapter can be plugged in later); the row is then marked as
 * published so it is never emitted twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTemplateSnapshotOutboxRelay {

    ProjectTemplateSnapshotOutboxRepository outboxRepository;

    @Scheduled(
            fixedDelayString = "${app.project-template-version.outbox.relay-ms:10000}",
            initialDelayString = "${app.project-template-version.outbox.initial-delay-ms:15000}"
    )
    @Transactional
    public void publishPending() {

        List<ProjectTemplateSnapshotOutboxEvent> pending =
                outboxRepository.findTop50ByStatusOrderByIdAsc(ProjectTemplateSnapshotOutboxStatus.PENDING);

        for (ProjectTemplateSnapshotOutboxEvent event : pending) {

            log.info("[PTV-OUTBOX] publish eventId={} type={} aggregateId={} correlationId={} payload={}",
                    event.getEventId(),
                    event.getEventType(),
                    event.getAggregateId(),
                    event.getCorrelationId(),
                    event.getPayload());

            event.setStatus(ProjectTemplateSnapshotOutboxStatus.PUBLISHED);
            event.setPublishedAt(LocalDateTime.now());
            outboxRepository.save(event);
        }
    }
}
