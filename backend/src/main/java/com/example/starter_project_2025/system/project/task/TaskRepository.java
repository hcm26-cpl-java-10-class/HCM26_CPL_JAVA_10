package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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

    @Query("select task from ProjectTask task where task.backlogItem.id in :backlogItemIds and task.isActive = true and task.status <> com.example.starter_project_2025.system.project.task.TaskStatus.DONE")
    List<Task> findUnfinishedByBacklogItemIds(@Param("backlogItemIds") List<Long> backlogItemIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select task from ProjectTask task where task.projectId = :projectId order by task.id")
    List<Task> lockProjectTasks(@Param("projectId") UUID projectId);
}
