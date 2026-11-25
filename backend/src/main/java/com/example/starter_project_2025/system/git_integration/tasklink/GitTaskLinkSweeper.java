package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.repository.BacklogReferenceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * SY-05 safety net and backfill: commits and pull requests without any reference row
 * (listener failed, or synchronized before this feature existed) are processed in
 * batches. A source counts as processed once it has a reference row, MISSING included.
 */
@Slf4j
@Component
public class GitTaskLinkSweeper {

    static final int BATCH_SIZE = 500;

    private final GitTaskLinker linker;
    private final BacklogReferenceRepository references;
    private final boolean enabled;

    public GitTaskLinkSweeper(GitTaskLinker linker, BacklogReferenceRepository references,
                              @Value("${app.github.task-link-sweep-enabled:true}") boolean enabled) {
        this.linker = linker;
        this.references = references;
        this.enabled = enabled;
    }

    @Scheduled(fixedDelayString = "${app.github.task-link-sweep-interval-ms:300000}",
            initialDelayString = "${app.github.task-link-sweep-initial-delay-ms:60000}")
    public void scheduled() {
        if (!enabled) return;
        try {
            int processed = sweep(null);
            if (processed > 0) log.info("Task links: processed {} commit(s) / pull request(s) left behind", processed);
        } catch (RuntimeException failure) {
            log.warn("Task link sweep failed; next run retries", failure);
        }
    }

    /** Processes every pending source, of one repository or of all ({@code null}); returns how many. */
    public int sweep(Long repositoryId) {
        int processed = 0;
        long afterId = 0L;
        while (true) {
            List<Long> ids = references.findUnprocessedCommitIds(afterId, repositoryId, GitArtifactType.COMMIT,
                    PageRequest.of(0, BATCH_SIZE));
            if (ids.isEmpty()) break;
            afterId = ids.get(ids.size() - 1);
            linker.linkCommits(ids);
            processed += ids.size();
            if (ids.size() < BATCH_SIZE) break;
        }
        afterId = 0L;
        while (true) {
            List<Long> ids = references.findUnprocessedPullRequestIds(afterId, repositoryId, GitArtifactType.PULL_REQUEST,
                    PageRequest.of(0, BATCH_SIZE));
            if (ids.isEmpty()) break;
            afterId = ids.get(ids.size() - 1);
            for (Long id : ids) linker.linkPullRequest(id);
            processed += ids.size();
            if (ids.size() < BATCH_SIZE) break;
        }
        return processed;
    }
}
