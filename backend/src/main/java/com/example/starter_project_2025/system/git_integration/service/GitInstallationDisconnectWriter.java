package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.domain.GitSyncJobStatus;
import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitSyncJobRepository;
import com.example.starter_project_2025.system.git_integration.sync.GitSyncJobStore;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * GI-07: one transaction that disconnects an installation (locked against a concurrent request and
 * the "deleted" webhook), every repository connection still receiving data through it (BR4), and
 * the sync jobs waiting for them. A running job stops at its next page (AC07).
 */
@Slf4j
@Component
public class GitInstallationDisconnectWriter {

    private final GitInstallationRepository installations;
    private final GitInstallationWriter installationWriter;
    private final GitRepositoryRepository connections;
    private final GitRepositoryConnectionWriter connectionWriter;
    private final GitSyncJobRepository jobs;
    private final Clock clock;

    public GitInstallationDisconnectWriter(GitInstallationRepository installations, GitInstallationWriter installationWriter,
                                           GitRepositoryRepository connections, GitRepositoryConnectionWriter connectionWriter,
                                           GitSyncJobRepository jobs, @Qualifier("gitIntegrationClock") Clock clock) {
        this.installations = installations;
        this.installationWriter = installationWriter;
        this.connections = connections;
        this.connectionWriter = connectionWriter;
        this.jobs = jobs;
        this.clock = clock;
    }

    /** {@code changed = false}: it was already DISCONNECTED (second request, or the webhook came first). */
    public record Result(boolean changed, int repositories) {
    }

    @Transactional
    public Result disconnect(Long installationRowId, Long actorUserId, String reason) {
        GitInstallation row = installations.lockById(installationRowId).orElseThrow(GitIntegrationException::installationNotFound);
        boolean changed = installationWriter.disconnect(row, actorUserId, reason);
        List<GitRepository> receiving = connections.findByInstallation_IdAndStatusIn(row.getId(), GitRepositoryRepository.RECEIVING);
        int repositories = connectionWriter.disconnectByInstallation(row.getId(), GitRepositoryReason.INSTALLATION_DELETED);
        LocalDateTime now = LocalDateTime.now(clock);
        int stopped = 0;
        for (GitRepository repository : receiving) {
            for (var job : jobs.findByRepository_IdAndStatus(repository.getId(), GitSyncJobStatus.PENDING)) {
                job.setStatus(GitSyncJobStatus.FAILED);
                job.setFinishedAt(now);
                job.setErrorCode(GitSyncJobStore.INSTALLATION_DISCONNECTED);
                job.setErrorMessage("The GitHub App was uninstalled from the repository's account");
                stopped++;
            }
        }
        log.info("GitHub installation disconnected: installationId={}, tenantId={}, reason={}, actorUserId={}, repositories={}, waitingJobsStopped={}",
                row.getInstallationId(), row.getTenantId(), reason, actorUserId, repositories, stopped);
        return new Result(changed, repositories);
    }
}
