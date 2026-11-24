package com.example.starter_project_2025.system.git_integration.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;

/** Removes OAuth states that expired more than a day ago (kept briefly for troubleshooting). */
@Slf4j
@Component
public class GitHubOAuthStateCleanupJob {

    private final GitHubOAuthStateService stateService;
    private final Clock clock;

    public GitHubOAuthStateCleanupJob(GitHubOAuthStateService stateService,
                                      @Qualifier("gitIntegrationClock") Clock clock) {
        this.stateService = stateService;
        this.clock = clock;
    }

    @Scheduled(cron = "${app.github.state-cleanup-cron:0 17 3 * * *}")
    public void deleteExpiredStates() {
        int deleted = stateService.deleteExpired(LocalDateTime.now(clock).minusDays(1));
        if (deleted > 0) {
            log.info("Deleted {} expired GitHub OAuth states", deleted);
        }
    }
}
