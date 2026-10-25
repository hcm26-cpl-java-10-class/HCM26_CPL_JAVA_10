package com.example.starter_project_2025.system.project.task.event;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TaskOutboxRelay {

    BoardTaskOutboxRepository outboxRepository;

    @Scheduled(
            fixedDelayString = "${app.task.outbox.relay-ms:10000}",
            initialDelayString = "${app.task.outbox.initial-delay-ms:15000}"
    )
    @Transactional
    public void publishPending() {
        for (BoardTaskOutboxEvent event : outboxRepository.findTop50ByStatusOrderByIdAsc(TaskOutboxStatus.PENDING)) {
            log.info("Task event published eventId={} eventType={} taskId={} correlationId={}",
                    event.getEventId(),
                    event.getEventType(),
                    event.getAggregateId(),
                    event.getCorrelationId());
            event.setStatus(TaskOutboxStatus.PUBLISHED);
            event.setPublishedAt(LocalDateTime.now());
            outboxRepository.save(event);
        }
    }
}
