package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.team.ProjectRole;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface BoardProjectMemberRepository extends BaseCrudRepository<BoardProjectMember, Long> {

    Optional<BoardProjectMember> findByIdAndProjectIdAndIsActiveTrue(Long id, Long projectId);

    List<BoardProjectMember> findAllByProjectIdAndIsActiveTrueOrderByIdAsc(Long projectId);

    List<BoardProjectMember> findAllByUserIdAndProjectRoleInAndIsActiveTrueOrderByProjectIdAsc(
            Long userId,
            Collection<ProjectRole> projectRoles
    );

    Optional<BoardProjectMember> findByProjectIdAndUserIdAndProjectRole(
            Long projectId,
            Long userId,
            ProjectRole projectRole
    );

    boolean existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
            Long projectId,
            Long userId,
            @Param("projectRoles") Collection<ProjectRole> projectRoles
    );

    List<BoardProjectMember> findAllByIdInAndProjectIdAndIsActiveTrue(
            Collection<Long> ids,
            Long projectId
    );
}
