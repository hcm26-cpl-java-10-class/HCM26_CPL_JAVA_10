package com.example.starter_project_2025.system.project.backlog_temp.event;

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
 * Relays pending backlog item outbox rows exactly once. In this starter project
 * the event is "delivered" to the application log (the notification adapter can
 * be plugged in later); the row is then marked as published so it is never
 * emitted twice.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskOutboxRelay {

    TaskOutboxRepository outboxRepository;

    @Scheduled(
            fixedDelayString = "${app.task.outbox.relay-ms:15000}",
            initialDelayString = "${app.task.outbox.initial-delay-ms:20000}"
    )
    @Transactional
    public void publishPending() {

        List<TaskOutboxEvent> pending =
                outboxRepository.findTop50ByStatusOrderByIdAsc(TaskOutboxStatus.PENDING);

        for (TaskOutboxEvent event : pending) {

            log.info("[TASK-OUTBOX] publish eventId={} type={} aggregateId={} correlationId={} payload={}",
                    event.getEventId(),
                    event.getEventType(),
                    event.getAggregateId(),
                    event.getCorrelationId(),
                    event.getPayload());

            event.setStatus(TaskOutboxStatus.PUBLISHED);
            event.setPublishedAt(LocalDateTime.now());
            outboxRepository.save(event);
        }
    }
}
