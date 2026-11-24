package com.example.starter_project_2025.system.project.developmentinsights.integration;

import com.example.starter_project_2025.system.git_integration.contributor.GitContributorMappingChangedEvent;
import com.example.starter_project_2025.system.git_integration.ingestion.event.*;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.service.GitRepositoryStatusChangedEvent;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobRequested;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitLinkedEvent;
import com.example.starter_project_2025.system.git_integration.tasklink.event.BacklogGitUnlinkedEvent;
import com.example.starter_project_2025.system.project.developmentinsights.domain.GitActivityChange;
import com.example.starter_project_2025.system.project.developmentinsights.repository.GitActivityChangeRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Coalesces notifications; retry always reads current source state rather than a stale payload. */
@Service
@Order(1000)
@Slf4j
@RequiredArgsConstructor
public class GitActivityIntegration implements ApplicationRunner {
    private final GitActivityChangeRepository changes;
    private final GitRepositoryRepository repositories;
    private final GitSyncJobRepository jobs;
    private final GitActivityProjector projector;
    private final GitActivitySourceMapping sourceMapping;
    private final PlatformTransactionManager transactions;
    @Value("${app.git-activity.projection.enabled:true}") private boolean enabled;
    @Value("${app.git-activity.projection.poller-enabled:true}") private boolean pollerEnabled;

    @Transactional
    public void request(Long repositoryId) {
        if (enabled && repositoryId != null) repositories.findById(repositoryId)
                .ifPresent(repo -> changes.save(GitActivityChange.request(repo)));
    }
    @EventListener @Transactional public void commits(CommitIngestedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void pullRequest(PullRequestIngestedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void review(ReviewIngestedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void source(GitSourceChangedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void linked(BacklogGitLinkedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void unlinked(BacklogGitUnlinkedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void connection(GitRepositoryStatusChangedEvent e) { request(e.repositoryId()); }
    @EventListener @Transactional public void sync(GitSyncJobRequested e) {
        jobs.findById(e.jobId()).ifPresent(job -> request(job.getRepositoryId()));
    }
    @EventListener @Transactional public void contributor(GitContributorMappingChangedEvent e) {
        repositories.findByProject_Id(e.masterProjectId()).forEach(repo -> request(repo.getId()));
    }

    @Override public void run(ApplicationArguments args) {
        if (enabled) repositories.findAll().forEach(repo -> request(repo.getId()));
    }
    @Scheduled(fixedDelayString = "${app.git-activity.projection.interval-ms:2000}", initialDelay = 5000)
    @SchedulerLock(name = "gitActivityProjection", lockAtMostFor = "PT10M")
    public void poll() { if (enabled && pollerEnabled) processPending(); }

    public int processPending() {
        Map<Long, Long> batches = new LinkedHashMap<>();
        changes.due(Instant.now(), PageRequest.of(0, 100)).forEach(change ->
                batches.merge(change.getRepository().getId(), change.getId(), Math::max));
        var transaction = new TransactionTemplate(transactions);
        transaction.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        int processed = 0;
        for (var batch : batches.entrySet()) {
            try {
                // Own source transactions finish before the projection transaction begins.
                sourceMapping.recover(batch.getKey());
                transaction.executeWithoutResult(status -> {
                    projector.refresh(batch.getKey());
                    changes.findByRepository_IdAndProcessedAtIsNullAndIdLessThanEqual(batch.getKey(), batch.getValue())
                            .forEach(GitActivityChange::complete);
                });
                processed++;
            } catch (RuntimeException failure) {
                transaction.executeWithoutResult(status -> changes
                        .findByRepository_IdAndProcessedAtIsNullAndIdLessThanEqual(batch.getKey(), batch.getValue())
                        .forEach(change -> change.retry(failure.getClass().getSimpleName())));
                log.warn("Git Activity repository {} will retry ({})", batch.getKey(), failure.getClass().getSimpleName());
            }
        }
        return processed;
    }
}
