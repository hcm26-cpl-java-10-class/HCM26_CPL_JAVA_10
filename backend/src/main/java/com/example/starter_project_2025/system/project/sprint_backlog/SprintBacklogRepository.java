package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface SprintBacklogRepository extends BaseCrudRepository<SprintBacklog, Long> {

    List<SprintBacklog> findBySprintIdOrderByIdAsc(Long sprintId);

    /**
     * Product backlog: every item that is not assigned to a sprint yet.
     * <p>
     * Used by the Sprint Planning / Backlog board to fill the "product
     * backlog" panel with the work items that can still be pulled into a
     * sprint.
     */
    List<SprintBacklog> findBySprintIsNullOrderByIdAsc();

    /**
     * Used by {@code SprintBacklogDataInitializer} to upsert the sample product
     * backlog rows idempotently.
     */
    Optional<SprintBacklog> findBySprintIsNullAndTitleIgnoreCase(String title);

    long countBySprintId(Long sprintId);

    /**
     * Backlog items of a sprint whose status is not one of the given values.
     * <p>
     * Used to enforce the "a sprint can only be completed when every backlog
     * item is Done" rule. The {@code status is null} branch is kept so a
     * defensive {@code null} status also counts as unfinished.
     */
    @Query("""
            select backlog
            from SprintBacklog backlog
            where backlog.sprint.id = :sprintId
              and (backlog.status is null or backlog.status not in :statuses)
            order by backlog.id asc
            """)
    List<SprintBacklog> findUnfinishedBySprintId(
            @Param("sprintId") Long sprintId,
            @Param("statuses") Collection<SprintBacklogStatus> statuses);

    /**
     * Used by {@code SprintBacklogDataInitializer} to upsert the sample rows
     * idempotently (a title is unique inside one sprint).
     */
    Optional<SprintBacklog> findBySprintIdAndTitleIgnoreCase(Long sprintId, String title);
}
