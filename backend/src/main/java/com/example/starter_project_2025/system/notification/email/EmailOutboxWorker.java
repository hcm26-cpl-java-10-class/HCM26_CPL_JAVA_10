package com.example.starter_project_2025.system.notification.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class EmailOutboxWorker {

    private final EmailOutboxService emailOutboxService;

    @Value("${app.notification.email-outbox-enabled:true}")
    private boolean enabled;

    @Scheduled(fixedDelayString = "${app.notification.email-outbox-poll-ms:15000}")
    public void pollAndDeliver() {
        if (!enabled) {
            return;
        }
        try {
            int sent = emailOutboxService.processPendingBatch();
            if (sent > 0) {
                log.debug("EmailOutboxWorker delivered {} queued email(s)", sent);
            }
        } catch (Exception ex) {
            log.error("EmailOutboxWorker failed: {}", EmailOutboxService.maskSensitiveError(ex.getMessage()));
        }
    }
}
