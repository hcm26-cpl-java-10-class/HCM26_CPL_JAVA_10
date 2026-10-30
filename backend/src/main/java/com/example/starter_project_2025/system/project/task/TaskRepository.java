package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository("taskRepository")
public interface TaskRepository extends BaseCrudRepository<Task, UUID> {
    long countByProjectIdAndMilestoneIdAndIsActiveTrue(UUID projectId, UUID milestoneId);
    long countByProjectIdAndMilestoneIdAndIsActiveTrueAndStatus(UUID projectId, UUID milestoneId, TaskStatus status);
    Optional<Task> findByIdAndIsActiveTrue(UUID id);
    List<Task> findAllByBacklogItem_IdAndIsActiveTrueOrderByCreatedAtAscIdAsc(Long backlogItemId);
    boolean existsByBacklogItem_Id(Long backlogItemId);

    /**
     * Titles of the subtasks of a sprint whose status is not one of the given
     * values, following the backlog item each subtask belongs to.
     * <p>
     * Used to enforce the "a sprint can only be completed when every subtask of
     * its backlog items is Done" rule. A defensive {@code null} status also
     * counts as unfinished.
     */
    @Query("""
            select subtask.title
            from ProjectTask subtask
            where subtask.isActive = true
              and subtask.backlogItem is not null
              and subtask.backlogItem.sprint.id = :sprintId
              and (subtask.status is null or subtask.status not in :statuses)
            order by subtask.id asc
            """)
    List<String> findUnfinishedSubtaskTitlesBySprintId(
            @Param("sprintId") Long sprintId,
            @Param("statuses") Collection<TaskStatus> statuses);

    /** Unfinished subtasks of a sprint, {@code Done} being the only final state. */
    default List<String> findUnfinishedSubtaskTitlesBySprintId(Long sprintId) {
        return findUnfinishedSubtaskTitlesBySprintId(sprintId, List.of(TaskStatus.DONE));
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select task from ProjectTask task where task.projectId = :projectId order by task.id")
    List<Task> lockProjectTasks(@Param("projectId") UUID projectId);
}
