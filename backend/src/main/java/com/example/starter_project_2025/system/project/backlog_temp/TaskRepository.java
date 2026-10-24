package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends BaseCrudRepository<Task, Long> {

    Optional<Task> findByProjectIdAndTitleIgnoreCase(Long projectId, String title);

    List<Task> findByProjectId(Long projectId);

    List<Task> findBySprintId(Long sprintId);

    /**
     * Sprint Backlog of a sprint, already ordered by the priority position set
     * during Sprint Planning (UFR-PRJ-003-03).
     */
    List<Task> findBySprintIdOrderBySprintOrderAscIdAsc(Long sprintId);

    /**
     * Items that still live in the product backlog of a project.
     */
    List<Task> findByProjectIdAndSprintIdIsNull(Long projectId);

    /**
     * Items that are not assigned to any sprint (used when the sprint has no
     * project scope yet).
     */
    List<Task> findBySprintIdIsNull();

    long countByStatus(TaskStatus status);
}
