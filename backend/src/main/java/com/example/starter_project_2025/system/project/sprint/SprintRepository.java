package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface SprintRepository extends BaseCrudRepository<Sprint, Long> {

    Optional<Sprint> findByName(String name);

    boolean existsByName(String name);

    boolean existsByNameAndIdNot(String name, Long id);

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
