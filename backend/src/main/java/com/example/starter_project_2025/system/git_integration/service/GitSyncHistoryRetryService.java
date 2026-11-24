package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncHistoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventStore;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * SY-06 AC04: the PM retries a FAILED webhook delivery of the project's repository. The delivery is
 * put back to RECEIVED and processed right after commit ({@link GitWebhookEventStore#replay}); its
 * status in the history follows the result. Only for a repository that still receives events
 * (an unlinked or disconnected one would only ignore it).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class GitSyncHistoryRetryService {

    private final GitIntegrationAccessService access;
    private final RepositoryActivityQueryService activity;
    private final GitRepositoryLinkPolicy policy;
    private final GitWebhookEventRepository events;
    private final GitWebhookEventStore store;

    @Transactional
    public void retry(Long projectId, Long eventId) {
        User user = access.requireUser();
        RepositoryActivityQueryService.ProjectRepositories scope = activity.repositoriesFor(projectId);
        policy.requireCanManage(user, scope.master()); // BR5

        GitWebhookEvent event = events.findById(eventId)
                .filter(row -> row.getRepositoryRef() != null && scope.byId().containsKey(row.getRepositoryRef()))
                .filter(row -> GitSyncHistoryRepository.DATA_EVENT_TYPES.contains(row.getEventType()))
                .orElseThrow(GitIntegrationException::syncHistoryNotFound);
        GitRepository repository = scope.byId().get(event.getRepositoryRef());
        if (!repository.getStatus().receivesEvents()) throw GitIntegrationException.repositoryNotReceiving();
        if (event.getStatus() != GitWebhookEventStatus.FAILED) throw GitIntegrationException.webhookEventNotReplayable();

        switch (store.replay(eventId, user.getTenant().getId(), user.getId())) {
            case QUEUED -> log.info("Webhook delivery retried from the sync history: eventId={}, projectId={}, by user {}",
                    eventId, scope.master().getId(), user.getId());
            case NOT_FOUND -> throw GitIntegrationException.syncHistoryNotFound();
            case NOT_REPLAYABLE -> throw GitIntegrationException.webhookEventNotReplayable();
            case PAYLOAD_PURGED -> throw GitIntegrationException.webhookPayloadPurged();
        }
    }
}
