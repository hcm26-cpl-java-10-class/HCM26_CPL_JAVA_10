package com.example.starter_project_2025.system.project;

import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class ProjectTeamOutboxRelay {

    private final ProjectTeamOutboxRepository outboxRepository;

    @Scheduled(
            fixedDelayString = "${app.project-team.outbox.relay-ms:10000}",
            initialDelayString = "${app.project-team.outbox.initial-delay-ms:15000}"
    )
    @Transactional
    public void publishPending() {
        List<ProjectTeamOutboxEvent> pending =
                outboxRepository.findTop50ByStatusOrderByIdAsc("PENDING");

        for (ProjectTeamOutboxEvent event : pending) {
            log.info("[PROJECT-TEAM-OUTBOX] published eventId={} type={} aggregateId={} correlationId={} payload={}",
                    event.getId(),
                    event.getEventType(),
                    event.getAggregateId(),
                    event.getCorrelationId(),
                    event.getPayload());
            event.setStatus("PUBLISHED");
            event.setPublishedAt(LocalDateTime.now());
            outboxRepository.save(event);
        }
    }
}
