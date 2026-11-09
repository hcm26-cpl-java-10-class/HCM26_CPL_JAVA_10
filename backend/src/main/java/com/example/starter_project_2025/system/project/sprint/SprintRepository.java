package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface SprintRepository extends BaseCrudRepository<Sprint, Long> {

    /**
     * Sprint names are unique inside the project workspace (UFR-PRJ-003-01,
     * AC03), not across the whole tenant: two different projects may both run a
     * "Sprint 1".
     */
    boolean existsByProjectIdAndName(Long projectId, String name);

    boolean existsByProjectIdAndNameAndIdNot(Long projectId, String name, Long id);

    /**
     * Team-only workspaces (no project linked yet) scope their sprint names to
     * the owning team instead.
     */
    boolean existsByTeamIdAndName(Long teamId, String name);

    boolean existsByTeamIdAndNameAndIdNot(Long teamId, String name, Long id);

    /** Fallback for sprints without a project and without a team. */
    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

    /** Seeding lookup: the first sprint of one project with that name. */
    Optional<Sprint> findFirstByProjectIdAndNameOrderByIdAsc(Long projectId, String name);

    List<Sprint> findAllByProjectIdAndIsActiveTrueOrderByStartDateDescIdDesc(Long projectId);

    List<Sprint> findAllByTeamIdAndIsActiveTrueOrderByStartDateDescIdDesc(Long teamId);

    /**
     * Sprints owned by one team, used by the Backlog tab of a team workspace
     * when the team is not linked to a project yet.
     */
    @Query("""
            select sprint
            from Sprint sprint
            where sprint.isActive = true
              and sprint.teamId = :teamId
            order by sprint.id asc
            """)
    List<Sprint> findActiveByTeamIdOrderByIdAsc(@Param("teamId") Long teamId);

    /**
     * Sprints of a team workspace: the sprints created for the team itself plus
     * the sprints of the project the team works on (seeded / project-scoped
     * sprints carry only the project reference).
     */
    @Query("""
            select sprint
            from Sprint sprint
            where sprint.isActive = true
              and (sprint.teamId = :teamId or sprint.projectId = :projectId)
            order by sprint.id asc
            """)
    List<Sprint> findActiveByTeamIdOrProjectIdOrderByIdAsc(@Param("teamId") Long teamId,
                                                           @Param("projectId") Long projectId);
}
