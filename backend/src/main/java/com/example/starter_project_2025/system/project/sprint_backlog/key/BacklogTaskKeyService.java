package com.example.starter_project_2025.system.project.sprint_backlog.key;

import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository.UnkeyedBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.key.TaskKeyContextResolver.Context;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/**
 * Generates and stores the Task ID ({@code task_key}) of backlog items.
 * <ul>
 *     <li>{@link #assign} / {@link #assignAll}: every code path that creates items
 *     calls it right before saving them (REST create, assignment publication,
 *     template provisioning, demo seed).</li>
 *     <li>{@link #backfillMissing()}: keys items saved without one (file import,
 *     a path that forgot to call {@code assign}); run after an import, at start-up
 *     and periodically.</li>
 *     <li>{@link #backfillLegacy()}: first deployment only, keeps the key users
 *     already saw on screen ({@code PREFIX-id}).</li>
 * </ul>
 */
@Slf4j
@Service
public class BacklogTaskKeyService {

    static final int BATCH_SIZE = 500;

    private final TaskKeyContextResolver resolver;
    private final TaskKeySequenceAllocator allocator;
    private final SprintBacklogRepository backlogs;
    private final BacklogTaskKeySequenceRepository sequences;
    private final TransactionTemplate transaction;

    public BacklogTaskKeyService(TaskKeyContextResolver resolver, TaskKeySequenceAllocator allocator,
                                 SprintBacklogRepository backlogs, BacklogTaskKeySequenceRepository sequences,
                                 PlatformTransactionManager transactionManager) {
        this.resolver = resolver;
        this.allocator = allocator;
        this.backlogs = backlogs;
        this.sequences = sequences;
        this.transaction = new TransactionTemplate(transactionManager);
    }

    /** Generates the Task ID of a new item; call right before it is saved. */
    public void assign(SprintBacklog item) {
        assignAll(List.of(item), null);
    }

    /**
     * Generates the Task IDs of new items, one counter reservation per (tenant, prefix).
     * Items already persisted or already keyed are skipped: a persisted item can only
     * get its key through {@link #backfillMissing()} (the columns are not updatable).
     *
     * @param prefixOverride the prefix to use instead of the resolved one (the caller
     *                       knows it better, e.g. the prefix of a workspace being created)
     */
    public void assignAll(Collection<SprintBacklog> items, String prefixOverride) {
        Map<String, Optional<Context>> resolved = new HashMap<>();
        Map<Context, List<SprintBacklog>> groups = new LinkedHashMap<>();
        for (SprintBacklog item : items) {
            if (item.getId() != null || item.getTaskKey() != null) continue;
            Long teamId = item.getSprint() == null ? null : item.getSprint().getTeamId();
            Optional<Context> context = resolved.computeIfAbsent(item.getProjectId() + ":" + teamId,
                    ignored -> resolver.resolve(item.getProjectId(), teamId));
            if (context.isEmpty()) {
                log.warn("Task ID not generated: no tenant for backlog item projectId={} teamId={}",
                        item.getProjectId(), teamId);
                continue;
            }
            Context target = prefixOverride == null ? context.get()
                    : new Context(context.get().tenantId(), TaskKeyFormat.prefixOrDefault(prefixOverride));
            groups.computeIfAbsent(target, ignored -> new ArrayList<>()).add(item);
        }
        groups.forEach((context, group) -> {
            long first = allocator.allocate(context.tenantId(), context.prefix(), group.size());
            for (int index = 0; index < group.size(); index++) {
                SprintBacklog item = group.get(index);
                item.setTenantId(context.tenantId());
                item.setTaskKeyNumber(first + index);
                item.setTaskKey(TaskKeyFormat.format(context.prefix(), first + index));
            }
        });
    }

    /** Keys every persisted item that has no Task ID yet, with new numbers. Returns how many. */
    public int backfillMissing() {
        return backfill(false);
    }

    /**
     * First deployment: an item keeps the key the screens showed so far ({@code PREFIX-id}),
     * then every counter is moved past the numbers taken. Falls back to a new number when
     * that key is already used.
     */
    public int backfillLegacy() {
        return backfill(true);
    }

    public boolean anyKeyAssigned() {
        return backlogs.existsByTaskKeyIsNotNull();
    }

    public List<String> prefixesOf(Long tenantId) {
        return sequences.findPrefixes(tenantId);
    }

    private int backfill(boolean legacy) {
        int total = 0;
        long afterId = 0L;
        while (true) {
            List<UnkeyedBacklog> rows = backlogs.findUnkeyed(afterId, PageRequest.of(0, BATCH_SIZE));
            if (rows.isEmpty()) break;
            afterId = rows.get(rows.size() - 1).getId();
            total += Objects.requireNonNull(transaction.execute(status -> keyPersisted(rows, legacy)));
            if (rows.size() < BATCH_SIZE) break;
        }
        return total;
    }

    private int keyPersisted(List<UnkeyedBacklog> rows, boolean legacy) {
        Map<String, Optional<Context>> resolved = new HashMap<>();
        Map<Context, List<UnkeyedBacklog>> groups = new LinkedHashMap<>();
        for (UnkeyedBacklog row : rows) {
            Optional<Context> context = resolved.computeIfAbsent(row.getProjectId() + ":" + row.getSprintTeamId(),
                    ignored -> resolver.resolve(row.getProjectId(), row.getSprintTeamId()));
            if (context.isEmpty()) {
                log.warn("Task ID not generated: no tenant for backlog item id={}", row.getId());
                continue;
            }
            groups.computeIfAbsent(context.get(), ignored -> new ArrayList<>()).add(row);
        }
        int keyed = 0;
        for (Map.Entry<Context, List<UnkeyedBacklog>> entry : groups.entrySet()) {
            Context context = entry.getKey();
            List<UnkeyedBacklog> pending = new ArrayList<>();
            long highest = 0;
            for (UnkeyedBacklog row : entry.getValue()) {
                String legacyKey = TaskKeyFormat.format(context.prefix(), row.getId());
                if (legacy && !backlogs.existsByTenantIdAndTaskKey(context.tenantId(), legacyKey)) {
                    keyed += backlogs.assignTaskKey(row.getId(), context.tenantId(), legacyKey, row.getId());
                    highest = Math.max(highest, row.getId());
                } else {
                    pending.add(row);
                }
            }
            if (highest > 0) allocator.raiseTo(context.tenantId(), context.prefix(), highest + 1);
            if (pending.isEmpty()) continue;
            long first = allocator.allocate(context.tenantId(), context.prefix(), pending.size());
            for (int index = 0; index < pending.size(); index++) {
                long number = first + index;
                keyed += backlogs.assignTaskKey(pending.get(index).getId(), context.tenantId(),
                        TaskKeyFormat.format(context.prefix(), number), number);
            }
        }
        return keyed;
    }
}
