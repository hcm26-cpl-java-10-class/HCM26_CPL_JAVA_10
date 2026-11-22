package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.contributor.GitProjectMembership;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallation;
import com.example.starter_project_2025.system.git_integration.domain.GitInstallationStatus;
import com.example.starter_project_2025.system.git_integration.domain.GitRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitInstallationRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitRepositoryRepository;
import com.example.starter_project_2025.system.git_integration.tasklink.ProjectScopeResolver;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * GI-02 AC03: tells the PMs and mentors of every master project read through an installation,
 * and the person who connected it, that the GitHub connection broke (SUSPENDED, ERROR,
 * DISCONNECTED) or works again. One notification per status change and person; the in-app
 * banner shows the current state anyway. Writes in a transaction of its own
 * ({@link Writer}) whose failure, even at commit, is only logged: a notification never undoes
 * or blocks a status change.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitConnectionNotifier {

    private final Writer writer;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStatusChanged(GitInstallationStatusChangedEvent event) {
        boolean broke = event.to() != GitInstallationStatus.CONNECTED;
        boolean recovered = event.to() == GitInstallationStatus.CONNECTED && event.from() != null && event.from().broken();
        if (!broke && !recovered) return;
        try {
            writer.notify(event, broke);
        } catch (RuntimeException e) {
            log.warn("GitHub connection notification failed: installationRowId={}, error={}", event.installationRowId(),
                    e.getClass().getSimpleName());
        }
    }

    @Slf4j
    @Component
    @RequiredArgsConstructor
    static class Writer {

        private final GitInstallationRepository installations;
        private final GitRepositoryRepository connections;
        private final ProjectScopeResolver scopes;
        private final GitProjectMembership membership;
        private final WorkspaceRepository workspaces;
        private final NotificationService notifications;

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void notify(GitInstallationStatusChangedEvent event, boolean broke) {
            GitInstallation installation = installations.findById(event.installationRowId()).orElse(null);
            if (installation == null) return;
            List<GitRepository> repositories = connections.findByInstallationRefAndStatusIn(installation.getId(),
                    GitRepositoryRepository.CURRENT);
            String title = broke ? "GitHub connection needs attention" : "GitHub connection restored";
            String message = message(installation.getAccountLogin(), event.to());
            long stamp = System.currentTimeMillis();
            Set<Long> notified = new LinkedHashSet<>();
            for (GitRepository repository : repositories) {
                Long masterId = repository.getProjectId();
                Set<Long> scope = scopes.scope(masterId);
                Set<Long> recipients = new LinkedHashSet<>(membership.mentorIds(scope));
                membership.members(scope).stream().filter(GitProjectMembership.Member::isPm).forEach(member -> recipients.add(member.userId()));
                String target = workspaces.findFirstByProjectIdOrderByIdAsc(masterId)
                        .map(workspace -> "/management/workspaces/" + workspace.getId() + "?tab=github")
                        .orElse("/git-integration");
                for (Long userId : recipients) {
                    if (!notified.add(userId)) continue;
                    notifications.createOnce(userId, key(installation, event, stamp, userId), title, message, target);
                }
            }
            Long connectedBy = installation.getConnectedByUserId();
            if (connectedBy != null && notified.add(connectedBy)) {
                notifications.createOnce(connectedBy, key(installation, event, stamp, connectedBy), title, message, "/git-integration");
            }
            log.info("GitHub connection notification: installationId={}, {} -> {}, recipients={}",
                    installation.getInstallationId(), event.from(), event.to(), notified.size());
        }

        static String message(String account, GitInstallationStatus status) {
            return switch (status) {
                case SUSPENDED -> "The GitHub App is suspended on " + account
                        + ". Commits and pull requests are not synchronized until it is unsuspended on GitHub.";
                case ERROR -> "GitHub refused the connection to " + account
                        + ". Check the connection again, or reconnect GitHub, so synchronization can continue.";
                case DISCONNECTED -> "The GitHub App was removed from " + account
                        + ". Synchronized data is kept; reconnect GitHub to synchronize again.";
                case CONNECTED -> "The GitHub connection to " + account + " works again. Synchronization continues.";
            };
        }

        private static String key(GitInstallation installation, GitInstallationStatusChangedEvent event, long stamp, Long userId) {
            return "git-connection:" + installation.getId() + ":" + event.to() + ":" + stamp + ":" + userId;
        }
    }
}
