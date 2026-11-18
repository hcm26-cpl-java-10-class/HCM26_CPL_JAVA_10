package com.example.starter_project_2025.system.exam.job;

import com.example.starter_project_2025.system.exam.domain.AnonymousSession;
import com.example.starter_project_2025.system.exam.domain.AnonymousSessionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class AnonymousSessionCleanupJob {

    private final AnonymousSessionRepository anonymousSessionRepository;

    @Value("${app.anonymous.session-ttl-hours:24}")
    private int sessionTtlHours;

    @Value("${app.anonymous.retention-days:30}")
    private int retentionDays;

    @Scheduled(cron = "${app.anonymous.cleanup-cron:0 0 3 * * *}")
    @Transactional
    public void cleanup() {
        try {
            LocalDateTime now = LocalDateTime.now();

            LocalDateTime staleBefore = now.minusHours(sessionTtlHours);
            List<AnonymousSession> stale = anonymousSessionRepository.findStaleSessions(staleBefore);

            for (AnonymousSession session : stale) {
                session.setIsValid(false);
            }

            if (!stale.isEmpty()) {
                anonymousSessionRepository.saveAll(stale);
                log.info("AnonymousSessionCleanupJob invalidated {} stale session(s)", stale.size());
            }

            List<AnonymousSession> expired = anonymousSessionRepository
                    .findStaleSessions(now.minusDays(retentionDays));

            if (!expired.isEmpty()) {
                anonymousSessionRepository.deleteAll(expired);
                log.info("AnonymousSessionCleanupJob purged {} session(s) older than {} days",
                        expired.size(), retentionDays);
            }
        } catch (Exception e) {
            log.error("AnonymousSessionCleanupJob failed: {}", e.getMessage(), e);
        }
    }
}