package com.example.starter_project_2025.system.project;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByCodeAndTenantId(String code, Long tenantId);
    java.util.List<Project> findByTenantIdAndIsActiveTrue(Long tenantId);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Project p where p.id = :id")
    Optional<Project> findForWorkspaceCreation(Long id);

    @org.springframework.data.jpa.repository.Modifying
    @Query("update Project p set p.status = com.example.starter_project_2025.system.project.ProjectStatus.ACTIVE where p.status = com.example.starter_project_2025.system.project.ProjectStatus.PLANNING and exists (select w.id from Workspace w where w.project.id = p.id and w.status = com.example.starter_project_2025.system.project.WorkspaceStatus.ACTIVE)")
    int activateProjectsWithWorkspace();
}

