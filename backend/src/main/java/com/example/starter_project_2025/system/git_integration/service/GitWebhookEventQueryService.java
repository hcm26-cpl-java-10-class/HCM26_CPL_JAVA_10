package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.config.GitHubAppProperties;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import com.example.starter_project_2025.system.git_integration.dto.GitPage;
import com.example.starter_project_2025.system.git_integration.dto.GitWebhookEventItem;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitWebhookEventRepository;
import com.example.starter_project_2025.system.git_integration.webhook.GitWebhookEventStore;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;

/**
 * SY-04: operations view of received webhook deliveries (status, retries, last
 * error) and manual replay. Needs {@code GIT_INTEGRATION_MANAGE}; scoped to the
 * user's tenant, including events not processed yet (tenant still unresolved)
 * that came from one of the tenant's installations.
 */
@Service
@RequiredArgsConstructor
public class GitWebhookEventQueryService {

    private final GitIntegrationAccessService access;
    private final GitProjectResolver projectResolver;
    private final GitWebhookEventRepository events;
    private final GitInstallationRepository installations;
    private final GitRepositoryRepository connections;
    private final GitWebhookEventStore store;
    private final GitHubAppProperties properties;

    public record EventQuery(GitWebhookEventStatus status, String eventType, Long projectId, int page, int size) {
    }

    @Transactional(readOnly = true)
    public GitPage<GitWebhookEventItem> list(EventQuery query) {
        User user = access.requireUser();
        access.requireManage(user);
        Long tenantId = user.getTenant().getId();
        int page = Math.max(query.page(), 0);
        int size = query.size() < 1 ? 20 : Math.min(query.size(), 100);

        List<Long> tenantInstallations = installations
                .findByTenantIdAndProviderAndIsActiveTrueOrderByConnectedAtDesc(tenantId, GitProvider.GITHUB)
                .stream().map(GitInstallation::getInstallationId).toList();
        List<Long> projectConnections = null;
        if (query.projectId() != null) {
            Project master = projectResolver.masterOf(projectResolver.require(user, query.projectId()));
            projectConnections = connections.findByProjectId(master.getId()).stream().map(GitRepository::getId).toList();
            if (projectConnections.isEmpty()) return GitPage.empty(page, size);
        }
        List<Long> scopedConnections = projectConnections;

        Specification<GitWebhookEvent> spec = (root, cq, cb) -> {
            List<Predicate> where = new ArrayList<>();
            Predicate ownTenant = cb.equal(root.get("tenantId"), tenantId);
            where.add(tenantInstallations.isEmpty() ? ownTenant
                    : cb.or(ownTenant, cb.and(cb.isNull(root.get("tenantId")), root.get("installationId").in(tenantInstallations))));
            if (query.status() != null) where.add(cb.equal(root.get("status"), query.status()));
            if (query.eventType() != null && !query.eventType().isBlank()) {
                where.add(cb.equal(root.get("eventType"), query.eventType().trim()));
            }
            if (scopedConnections != null) where.add(root.get("repositoryRef").in(scopedConnections));
            return cb.and(where.toArray(Predicate[]::new));
        };
        return GitPage.of(events.findAll(spec, PageRequest.of(page, size,
                Sort.by(Sort.Order.desc("receivedAt"), Sort.Order.desc("id")))), this::item);
    }

    /** 202 when queued; 404 outside the tenant; 409 when not replayable or the payload is gone. */
    public void replay(Long eventId) {
        User user = access.requireUser();
        access.requireManage(user);
        switch (store.replay(eventId, user.getTenant().getId(), user.getId())) {
            case QUEUED -> { }
            case NOT_FOUND -> throw GitIntegrationException.webhookEventNotFound();
            case NOT_REPLAYABLE -> throw GitIntegrationException.webhookEventNotReplayable();
            case PAYLOAD_PURGED -> throw GitIntegrationException.webhookPayloadPurged();
        }
    }

    private GitWebhookEventItem item(GitWebhookEvent e) {
        boolean replayable = e.getPayload() != null && (e.getStatus() == GitWebhookEventStatus.FAILED
                || (e.getStatus() == GitWebhookEventStatus.IGNORED && GitWebhookEventStore.REPLAYABLE_TYPES.contains(e.getEventType())));
        Long latency = e.getProcessedAt() == null || e.getReceivedAt() == null ? null
                : Duration.between(e.getReceivedAt(), e.getProcessedAt()).toMillis();
        return new GitWebhookEventItem(e.getId(), e.getDeliveryId(), e.getEventType(), e.getAction(), e.getRepoFullName(),
                e.getSenderLogin(), e.getStatus(), Math.max(e.getAttempts() - 1, 0), properties.getWebhookMaxRetries(),
                e.getStatus() == GitWebhookEventStatus.FAILED_RETRYABLE ? e.getNextAttemptAt() : null,
                e.getLastError(), e.getReceivedAt(), e.getProcessedAt(), latency, replayable);
    }
}
