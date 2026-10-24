package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectMemberRepository extends BaseCrudRepository<ProjectMember, Long> {

    Optional<ProjectMember> findByIdAndProjectIdAndIsActiveTrue(Long id, Long projectId);

    List<ProjectMember> findAllByProjectIdAndIsActiveTrueOrderByIdAsc(Long projectId);

    List<ProjectMember> findAllByUserIdAndProjectRoleInAndIsActiveTrueOrderByProjectIdAsc(
            Long userId,
            Collection<ProjectRole> projectRoles
    );

    Optional<ProjectMember> findByProjectIdAndUserIdAndProjectRole(
            Long projectId,
            Long userId,
            ProjectRole projectRole
    );

    boolean existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(
            Long projectId,
            Long userId,
            @Param("projectRoles") Collection<ProjectRole> projectRoles
    );

    List<ProjectMember> findAllByIdInAndProjectIdAndIsActiveTrue(
            Collection<Long> ids,
            Long projectId
    );
}
