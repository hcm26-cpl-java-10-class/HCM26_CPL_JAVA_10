package com.example.starter_project_2025.system.project.analytics;

import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLog;
import com.example.starter_project_2025.system.project.task.Task;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.task.audit.TaskAuditLog;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * US-ANL-002: data collection query of the Analytics view.
 *
 * <p>The work items are read from {@code sprint_backlog} — the project Task
 * table that carries {@code project_id}, {@code sprint_id}, {@code status},
 * {@code work_type} and the {@code created_at} / {@code updated_at} audit
 * columns — and joined to {@code sprint} so the project scope also matches
 * items that only inherit the project from their sprint
 * ({@code sprint.project_id}). A row with {@code sprint_id IS NULL} is a
 * product backlog item (AC02).</p>
 *
 * <p>Everything here is a read: the analytics view must never move, plan or
 * complete a work item.</p>
 */
@Repository
@RequiredArgsConstructor
public class ProjectAnalyticsWorkItemRepository {

    private final EntityManager entityManager;

    /**
     * Work items of one project, narrowed by scope and work item type.
     *
     * @param projectId   project to report on
     * @param sprintId    sprint restriction; ignored when {@code backlogOnly}
     * @param backlogOnly {@code true} to keep only items without a sprint
     * @param workType    work item type restriction; {@code null} means all
     */
    public List<SprintBacklog> findWorkItems(Long projectId, Long sprintId, boolean backlogOnly,
                                             SprintBacklogWorkType workType) {
        StringBuilder jpql = new StringBuilder("""
                select item
                from SprintBacklog item
                left join item.sprint sprint
                where item.isActive = true
                  and (item.projectId = :projectId or sprint.projectId = :projectId)
                """);
        if (backlogOnly) {
            jpql.append("\n  and sprint is null");
        } else if (sprintId != null) {
            jpql.append("\n  and sprint.id = :sprintId");
        }
        if (workType != null) {
            jpql.append("\n  and item.workType = :workType");
        }
        jpql.append("\norder by item.createdAt asc, item.id asc");

        TypedQuery<SprintBacklog> query = entityManager
                .createQuery(jpql.toString(), SprintBacklog.class)
                .setParameter("projectId", projectId);
        if (!backlogOnly && sprintId != null) {
            query.setParameter("sprintId", sprintId);
        }
        if (workType != null) {
            query.setParameter("workType", workType);
        }
        return query.getResultList();
    }

    /** Number of work items per sprint, used by the Sprint dropdown (US-ANL-002). */
    public Map<Long, Long> countWorkItemsBySprint(Long projectId) {
        List<Object[]> rows = entityManager.createQuery("""
                select sprint.id, count(item)
                from SprintBacklog item
                join item.sprint sprint
                where item.isActive = true
                  and (item.projectId = :projectId or sprint.projectId = :projectId)
                group by sprint.id
                """, Object[].class)
                .setParameter("projectId", projectId)
                .getResultList();
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : rows) {
            if (row[0] instanceof Long sprintId && row[1] instanceof Number total) {
                counts.put(sprintId, total.longValue());
            }
        }
        return counts;
    }

    /** Number of unassigned (product backlog) work items of one project. */
    public long countProductBacklog(Long projectId) {
        return entityManager.createQuery("""
                select count(item)
                from SprintBacklog item
                where item.isActive = true
                  and item.sprint is null
                  and item.projectId = :projectId
                """, Long.class)
                .setParameter("projectId", projectId)
                .getSingleResult();
    }

    /**
     * US-ANL-003: status transitions of the given work items, oldest first.
     *
     * <p>Cycle time ("first move to In progress → Done") and lead time
     * ("creation → Done") need the actual transition dates, which only the
     * append-only backlog audit trail keeps. The query is bounded by
     * {@code asOf} so a report window never counts a transition that happened
     * later, and it is only executed for items that are Done (see
     * {@link ProjectAnalyticsService}).</p>
     *
     * @param itemIds work items to read the history of; must not be empty
     * @param asOf    latest timestamp to consider
     */
    public List<SprintBacklogAuditLog> findStatusEvents(List<Long> itemIds, LocalDateTime asOf) {
        if (itemIds == null || itemIds.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery("""
                select event
                from BacklogItemAuditLog event
                where event.sprintBacklogId in :itemIds
                  and event.createdAt <= :asOf
                order by event.createdAt asc, event.id asc
                """, SprintBacklogAuditLog.class)
                .setParameter("itemIds", itemIds)
                .setParameter("asOf", asOf)
                .getResultList();
    }

    /**
     * US-ANL-006: active Done subtasks belonging to the in-scope backlog items.
     *
     * <p>Subtasks live in {@code task} ({@code ProjectTask}) and inherit their
     * project / sprint / backlog scope from {@code backlogItem}.</p>
     */
    public List<Task> findDoneSubtasks(List<Long> backlogItemIds) {
        if (backlogItemIds == null || backlogItemIds.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery("""
                select subtask
                from ProjectTask subtask
                where subtask.isActive = true
                  and subtask.backlogItem.id in :backlogItemIds
                  and subtask.status = :done
                order by subtask.createdAt asc, subtask.id asc
                """, Task.class)
                .setParameter("backlogItemIds", backlogItemIds)
                .setParameter("done", TaskStatus.DONE)
                .getResultList();
    }

    /**
     * US-ANL-006: status audit history of the given subtasks, oldest first,
     * bounded by {@code asOf}.
     */
    public List<TaskAuditLog> findSubtaskStatusEvents(List<UUID> subtaskIds, LocalDateTime asOf) {
        if (subtaskIds == null || subtaskIds.isEmpty()) {
            return List.of();
        }
        return entityManager.createQuery("""
                select event
                from TaskAuditLog event
                where event.taskId in :subtaskIds
                  and event.occurredAt <= :asOf
                order by event.occurredAt asc, event.id asc
                """, TaskAuditLog.class)
                .setParameter("subtaskIds", subtaskIds)
                .setParameter("asOf", asOf)
                .getResultList();
    }
}
