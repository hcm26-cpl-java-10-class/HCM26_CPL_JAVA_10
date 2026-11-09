package com.example.starter_project_2025.system.project.sprint.event;

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
 * Relays pending outbox rows exactly once. In this starter project the event is
 * "delivered" to the application log (the notification adapter can be plugged
 * in later); the row is then marked as published so it is never emitted twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class SprintOutboxRelay {

    SprintOutboxRepository outboxRepository;

    @Scheduled(fixedDelayString = "${app.sprint.outbox.relay-ms:10000}", initialDelayString = "${app.sprint.outbox.initial-delay-ms:15000}")
    @Transactional
    public void publishPending() {

        List<SprintOutboxEvent> pending =
                outboxRepository.findTop50ByStatusOrderByIdAsc(SprintOutboxStatus.PENDING);

        for (SprintOutboxEvent event : pending) {

            log.info("[SPRINT-OUTBOX] publish eventId={} type={} aggregateId={} correlationId={} payload={}",
                    event.getEventId(),
                    event.getEventType(),
                    event.getAggregateId(),
                    event.getCorrelationId(),
                    event.getPayload());

            event.setStatus(SprintOutboxStatus.PUBLISHED);
            event.setPublishedAt(LocalDateTime.now());
            outboxRepository.save(event);
        }
    }
}
