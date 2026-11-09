package com.example.starter_project_2025.system.project.workspace.repository;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface WorkspaceRepository extends JpaRepository<Workspace, Long>, JpaSpecificationExecutor<Workspace> {

    @EntityGraph(attributePaths = {"tenant", "project", "team", "team.project", "team.trainingClass"})
    List<Workspace> findAllByTenant_IdAndStatusAndIsActiveTrue(Long tenantId, WorkspaceStatus status);

    Optional<Workspace> findByProjectIdAndTeamId(Long projectId, Long teamId);

    Optional<Workspace> findFirstByProjectIdOrderByIdAsc(Long projectId);

    boolean existsByProjectIdAndTeamId(Long projectId, Long teamId);
    boolean existsByProjectId(Long projectId);
    Optional<Workspace> findFirstByTeamIdOrderByIdAsc(Long teamId);
}

