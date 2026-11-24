package com.example.starter_project_2025.system.git_integration.tasklink;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * TM-03 one-off back-fill: merge commits stored before they took the tasks of their pull
 * request ({@link GitTaskLinker#syncMergeCommit}) are linked now. Nothing is left on the next start.
 */
@Slf4j
@Component
@Order(11)
@RequiredArgsConstructor
public class MergeCommitLinkBackfill implements CommandLineRunner {

    private final GitTaskLinker linker;

    @Override
    public void run(String... args) {
        try {
            int linked = linker.syncMergeCommits(null);
            if (linked > 0) log.info("Task links: linked {} merge commit(s) to the tasks of their pull request", linked);
        } catch (RuntimeException failure) {
            log.warn("Task links: merge commits could not be back-filled; the next re-check retries", failure);
        }
    }
}
