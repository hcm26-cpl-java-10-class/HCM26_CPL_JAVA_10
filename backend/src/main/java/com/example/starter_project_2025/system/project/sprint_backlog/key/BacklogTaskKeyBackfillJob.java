package com.example.starter_project_2025.system.project.sprint_backlog.key;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Safety net: an item saved by a path that does not call {@link BacklogTaskKeyService#assign}
 * gets its Task ID within minutes. The warning tells developers such a path exists.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class BacklogTaskKeyBackfillJob {

    private final BacklogTaskKeyService taskKeys;

    @Scheduled(fixedDelayString = "${app.backlog.task-key-backfill-interval-ms:600000}",
            initialDelayString = "${app.backlog.task-key-backfill-interval-ms:600000}")
    public void backfill() {
        int keyed = taskKeys.backfillMissing();
        if (keyed > 0) log.warn("Task ID backfilled for {} backlog item(s) saved without one", keyed);
    }
}
