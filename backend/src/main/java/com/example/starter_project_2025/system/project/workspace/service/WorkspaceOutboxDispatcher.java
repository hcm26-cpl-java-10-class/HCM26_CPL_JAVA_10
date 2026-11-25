package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceOutboxEvent;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceOutboxRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.workspace.outbox.enabled", havingValue = "true", matchIfMissing = true)
public class WorkspaceOutboxDispatcher {
    private final WorkspaceOutboxRepository outbox;
    private final WorkspaceOutboxDelivery delivery;

    @Scheduled(fixedDelayString = "${app.workspace.outbox.poll-interval-ms:1000}")
    public void dispatchPending() {
        for (WorkspaceOutboxEvent event : outbox.findTop25ByDeliveredAtIsNullOrderByIdAsc()) {
            try { delivery.deliver(event.getId()); }
            catch (RuntimeException exception) { log.warn("Workspace event {} will be retried", event.getEventId()); }
        }
    }
}
