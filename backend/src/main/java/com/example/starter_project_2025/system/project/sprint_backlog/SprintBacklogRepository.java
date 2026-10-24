package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SprintBacklogRepository extends BaseCrudRepository<SprintBacklog, Long> {

    List<SprintBacklog> findBySprintIdOrderByIdAsc(Long sprintId);

    long countBySprintId(Long sprintId);

    /**
     * Used by {@code SprintBacklogDataInitializer} to upsert the sample rows
     * idempotently (a title is unique inside one sprint).
     */
    Optional<SprintBacklog> findBySprintIdAndTitleIgnoreCase(Long sprintId, String title);
}
