package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.contributor.GitProjectMembership;
import com.example.starter_project_2025.system.git_integration.domain.GitRepositoryStatus;
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
import java.util.Set;

/**
 * GI-05 AC04: tells the PMs of a master project (and of its modules, who see the same banner) that
 * its repository was disconnected by GitHub or failed, and when it works again. One notification
 * per status change and person. Not sent for a user's own unlink / relink, nor when the whole
 * installation was deleted ({@link GitConnectionNotifier} already reports that). Written in a
 * transaction of its own whose failure is only logged.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class GitRepositoryNotifier {

    private final Writer writer;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStatusChanged(GitRepositoryStatusChangedEvent event) {
        if (!relevant(event)) return;
        try {
            writer.notify(event);
        } catch (RuntimeException e) {
            log.warn("Repository status notification failed: repositoryId={}, error={}", event.repositoryId(),
                    e.getClass().getSimpleName());
        }
    }

    static boolean relevant(GitRepositoryStatusChangedEvent event) {
        if (GitRepositoryReason.INSTALLATION_DELETED.equals(event.reason())) return false;
        boolean broke = event.to() == GitRepositoryStatus.DISCONNECTED || event.to() == GitRepositoryStatus.ERROR;
        boolean recovered = event.to() == GitRepositoryStatus.ACTIVE
                && (event.from() == GitRepositoryStatus.DISCONNECTED || event.from() == GitRepositoryStatus.ERROR);
        return broke || recovered;
    }

    @Slf4j
    @Component
    @RequiredArgsConstructor
    static class Writer {

        private final ProjectScopeResolver scopes;
        private final GitProjectMembership membership;
        private final WorkspaceRepository workspaces;
        private final NotificationService notifications;

        @Transactional(propagation = Propagation.REQUIRES_NEW)
        public void notify(GitRepositoryStatusChangedEvent event) {
            Set<Long> recipients = new LinkedHashSet<>();
            membership.members(scopes.scope(event.projectId())).stream()
                    .filter(GitProjectMembership.Member::isPm)
                    .forEach(member -> recipients.add(member.userId()));
            if (recipients.isEmpty()) return;
            String target = workspaces.findFirstByProjectIdOrderByIdAsc(event.projectId())
                    .map(workspace -> "/management/workspaces/" + workspace.getId() + "?tab=github")
                    .orElse("/git-integration");
            String title = event.to() == GitRepositoryStatus.ACTIVE ? "Repository connection restored" : "Repository needs attention";
            String message = message(event.fullName(), event.to(), event.reason());
            long stamp = System.currentTimeMillis();
            for (Long userId : recipients) {
                String key = "git-repository:" + event.repositoryId() + ":" + event.to() + ":" + stamp + ":" + userId;
                notifications.createOnce(userId, key, title, message, target);
            }
            log.info("Repository status notification: repositoryId={}, {} -> {}, recipients={}",
                    event.repositoryId(), event.from(), event.to(), recipients.size());
        }

        static String message(String repository, GitRepositoryStatus status, String reason) {
            return switch (status) {
                case DISCONNECTED -> GitRepositoryReason.REPOSITORY_DELETED.equals(reason)
                        ? repository + " was deleted on GitHub. Synchronized data is kept; unlink it and link another repository."
                        : "GitHub no longer gives access to " + repository
                        + ". Synchronized data is kept; grant the GitHub App access to it again, or unlink it.";
                case ERROR -> "Synchronizing " + repository + " failed. Sync it again, or check its access on GitHub.";
                case ACTIVE -> repository + " is connected again. Synchronization continues.";
                case INACTIVE -> repository + " was unlinked.";
            };
        }
    }
}
