package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ProjectTeamRepository
        extends BaseCrudRepository<ProjectTeam, Long> {

    boolean existsByProjectTemplate_Id(Long templateId);

    Optional<ProjectTeam> findByIdAndAllocationSession_Id(
            Long teamId,
            Long sessionId
    );

    List<ProjectTeam> findAllByAllocationSession_IdOrderByIdAsc(Long sessionId);

    List<ProjectTeam> findAllByAllocationSession_IdAndStatusOrderByIdAsc(
            Long sessionId,
            ProjectTeamStatus status
    );

    List<ProjectTeam> findAllByAllocationSession_IdAndStatus(
            Long sessionId,
            ProjectTeamStatus status
    );

    @EntityGraph(attributePaths = {"trainingClass", "project"})
    List<ProjectTeam> findAllByTrainingClass_TenantIdOrderByIdAsc(Long tenantId);

    @EntityGraph(attributePaths = {"trainingClass", "project"})
    Optional<ProjectTeam> findByIdAndTrainingClass_TenantId(Long id, Long tenantId);

    Optional<ProjectTeam> findByTrainingClass_IdAndTeamName(Long trainingClassId, String teamName);

    List<ProjectTeam> findAllByProject_IdInOrderByIdDesc(List<Long> projectIds);

    boolean existsByProject_IdAndIdNot(Long projectId, Long teamId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select team from ProjectTeam team where team.id = :id")
    Optional<ProjectTeam> findForWorkspaceCreation(Long id);

    boolean existsByAllocationSession_IdAndStatus(
            Long sessionId,
            ProjectTeamStatus status
    );
}
