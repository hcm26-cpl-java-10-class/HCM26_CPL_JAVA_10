package com.example.starter_project_2025.system.project;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class WorkspaceOutboxDelivery {
    private final WorkspaceOutboxRepository outbox;
    private final WorkspaceJournalService journal;

    @Transactional
    public void deliver(Long id) {
        WorkspaceOutboxEvent event = outbox.findForDelivery(id).orElse(null);
        if (event == null || event.getDeliveredAt() != null) return;
        journal.recordActivityOnce(event);
        event.setDeliveredAt(Instant.now());
        outbox.saveAndFlush(event);
    }
}
