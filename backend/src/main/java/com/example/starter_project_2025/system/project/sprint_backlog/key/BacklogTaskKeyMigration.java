package com.example.starter_project_2025.system.project.sprint_backlog.key;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Start-up migration of Task IDs, idempotent. Runs before every seeder ({@code @Order(0)})
 * so the legacy keys are kept before any new key is generated.
 * <ol>
 *     <li>Workspaces created before {@code task_key_prefix} existed have a NULL prefix:
 *     they get the acronym the screens displayed for them ({@code SSP}), else {@code FA}.</li>
 *     <li>No item has a key yet (first deployment): keep the displayed {@code PREFIX-id}.
 *     Otherwise: key the items saved without one with new numbers.</li>
 * </ol>
 */
@Slf4j
@Component
@Order(0)
public class BacklogTaskKeyMigration implements CommandLineRunner {

    private final WorkspaceRepository workspaces;
    private final BacklogTaskKeyService taskKeys;
    private final TransactionTemplate transaction;

    public BacklogTaskKeyMigration(WorkspaceRepository workspaces, BacklogTaskKeyService taskKeys,
                                   PlatformTransactionManager transactionManager) {
        this.workspaces = workspaces;
        this.taskKeys = taskKeys;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    @Override
    public void run(String... args) {
        Integer prefixes = transaction.execute(status -> fillMissingPrefixes());
        if (prefixes != null && prefixes > 0) log.info("Task key prefix set on {} workspace(s) without one", prefixes);

        boolean legacy = !taskKeys.anyKeyAssigned();
        int keyed = legacy ? taskKeys.backfillLegacy() : taskKeys.backfillMissing();
        if (keyed > 0) log.info("Task ID generated for {} backlog item(s) ({})", keyed, legacy ? "legacy keys kept" : "new numbers");
    }

    private int fillMissingPrefixes() {
        int updated = 0;
        for (Workspace workspace : workspaces.findAll()) {
            if (TaskKeyFormat.isValidPrefix(workspace.getTaskKeyPrefix())) continue;
            String projectName = workspace.getProject() == null ? null : workspace.getProject().getName();
            workspace.setTaskKeyPrefix(TaskKeyFormat.acronym(projectName).orElse(TaskKeyFormat.DEFAULT_PREFIX));
            workspaces.save(workspace);
            updated++;
        }
        return updated;
    }
}
