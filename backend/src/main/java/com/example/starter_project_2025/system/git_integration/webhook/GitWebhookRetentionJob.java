package com.example.starter_project_2025.system.git_integration.webhook;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * SY-03: drops the raw payload of finished webhook events after
 * {@code app.github.webhook-payload-retention-days}; the event rows stay as the
 * audit trail. Unfinished events (RECEIVED/FAILED) keep their payload.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitWebhookRetentionJob {

    private final GitWebhookEventStore store;
    private final GitHubAppProperties properties;

    @Scheduled(cron = "${app.github.webhook-retention-cron:0 30 3 * * *}")
    public void purge() {
        int purged = store.purgePayloads();
        if (purged > 0) {
            log.info("Purged {} webhook payload(s) older than {} days", purged, properties.getWebhookPayloadRetentionDays());
        }
    }
}
