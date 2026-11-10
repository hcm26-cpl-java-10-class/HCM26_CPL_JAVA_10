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
    @Query("""
            select case when count(item) > 0 then true else false end
            from SprintBacklog item left join item.sprint sprint
            where item.isActive = true and item.status = :status
              and (sprint.teamId = :teamId
                   or (:projectId is not null and (item.projectId = :projectId or sprint.projectId = :projectId)))
            """)
    boolean existsInWorkspaceStatus(@Param("teamId") Long teamId, @Param("projectId") Long projectId,
                                   @Param("status") SprintBacklogStatus status);
    boolean existsByMilestone_Id(java.util.UUID milestoneId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select item from SprintBacklog item where item.id = :id")
    Optional<SprintBacklog> findForSubtaskUpdate(@Param("id") Long id);

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

    /**
     * Product backlog item of one project, used by the per-project workspace
     * demo seed so the same title can exist in two projects.
     */
    Optional<SprintBacklog> findByProjectIdAndSprintIsNullAndTitleIgnoreCase(Long projectId, String title);

    /**
     * Deterministic lookup for startup demo upserts when a local database
     * already contains duplicate product-backlog rows from an earlier seed.
     */
    Optional<SprintBacklog> findFirstByProjectIdAndSprintIsNullAndTitleIgnoreCaseOrderByIdAsc(
            Long projectId,
            String title);

    List<SprintBacklog> findAllByProjectIdAndSprintIsNullAndTitleIgnoreCaseOrderByIdAsc(
            Long projectId,
            String title);

    List<SprintBacklog> findAllByProjectIdAndTitleIgnoreCaseAndIsActiveTrue(Long projectId, String title);

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

    /**
     * Deterministic lookup for startup demo upserts when a local database
     * already contains duplicate sprint-backlog rows from an earlier seed.
     */
    Optional<SprintBacklog> findFirstBySprintIdAndTitleIgnoreCaseOrderByIdAsc(Long sprintId, String title);

    List<SprintBacklog> findAllBySprintIdAndTitleIgnoreCaseOrderByIdAsc(Long sprintId, String title);

    /**
     * Work items that live in a sprint owned by the team, used by the Backlog
     * tab of a team workspace when the team is not linked to a project.
     */
    @Query("""
            select backlog
            from SprintBacklog backlog
            join backlog.sprint sprint
            where sprint.isActive = true
              and backlog.isActive = true
              and sprint.teamId = :teamId
            order by backlog.id asc
            """)
    List<SprintBacklog> findActiveBySprintTeamId(@Param("teamId") Long teamId);

    /**
     * Work items of a team workspace: the items of the team sprints plus the
     * items of the sprints that belong to the project of the team.
     */
    @Query("""
            select backlog
            from SprintBacklog backlog
            join backlog.sprint sprint
            where sprint.isActive = true
              and backlog.isActive = true
              and (sprint.teamId = :teamId or sprint.projectId = :projectId)
            order by backlog.id asc
            """)
    List<SprintBacklog> findActiveBySprintTeamIdOrProjectId(@Param("teamId") Long teamId,
                                                            @Param("projectId") Long projectId);

    /**
     * Product backlog (no sprint assigned yet) of one project, used by the
     * Backlog tab of the team workspace that works on that project.
     */
    @Query("""
            select backlog
            from SprintBacklog backlog
            where backlog.sprint is null
              and backlog.projectId = :projectId
              and backlog.isActive = true
            order by backlog.id asc
            """)
    List<SprintBacklog> findProductBacklogByProjectId(@Param("projectId") Long projectId);
}
