package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

/**
 * SY-05: the read-only backlog (task) lookups Git Integration needs, kept inside this
 * module so the backlog module's repository is not changed for it. Nothing here writes
 * a backlog item: linking commits never changes a task (AC05).
 */
public interface GitBacklogLookupRepository extends Repository<SprintBacklog, Long> {

    interface BacklogItemRow {
        Long getId();
        String getTaskKey();
        Long getTenantId();
        Long getProjectId();
        Long getSprintTeamId();
        Boolean getIsActive();
        String getTitle();
        SprintBacklogStatus getStatus();
    }

    @Query("""
            select b.id as id, b.taskKey as taskKey, b.tenantId as tenantId, b.projectId as projectId,
                   s.teamId as sprintTeamId, b.isActive as isActive, b.title as title, b.status as status
              from SprintBacklog b left join b.sprint s
             where b.tenantId = :tenantId and b.taskKey in :keys""")
    List<BacklogItemRow> findByKeys(@Param("tenantId") Long tenantId, @Param("keys") Collection<String> keys);

    @Query("""
            select b.id as id, b.taskKey as taskKey, b.tenantId as tenantId, b.projectId as projectId,
                   s.teamId as sprintTeamId, b.isActive as isActive, b.title as title, b.status as status
              from SprintBacklog b left join b.sprint s
             where b.id in :ids""")
    List<BacklogItemRow> findByIds(@Param("ids") Collection<Long> ids);

    /** Active tasks with the given status in these projects that have no link of the given type. */
    @Query("""
            select count(b) from SprintBacklog b
             where b.projectId in :projectIds and b.isActive = true and b.status = :status
               and not exists (select l.id from BacklogGitLink l where l.backlogItem.id = b.id and l.artifactType = :type)""")
    long countWithoutLinks(@Param("projectIds") Collection<Long> projectIds, @Param("status") SprintBacklogStatus status,
                           @Param("type") GitArtifactType type);
}
