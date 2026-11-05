package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.project.domain.Project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ProjectRepository extends BaseCrudRepository<Project, Long> {

    boolean existsByTemplateSnapshotIdIn(java.util.Collection<Long> snapshotIds);

    java.util.Optional<Project> findByCode(String code);
    java.util.Optional<Project> findByCodeAndTenantId(String code, Long tenantId);
    java.util.List<Project> findByTenantIdAndIsActiveTrue(Long tenantId);

    java.util.List<Project> findAllByAssignmentIdAndTenantIdAndIsActiveTrueOrderByIdAsc(Long assignmentId, Long tenantId);
    java.util.List<Project> findAllByParentProject_IdAndIsActiveTrueOrderByIdAsc(Long parentId);

    /**
     * Import-only lookup: resolves the project referenced by name in a
     * {@code project-template-versions} file. An ambiguous (duplicated) name
     * fails only the import row that supplied it.
     */
    java.util.Optional<Project> findByName(String name);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Project p where p.id = :id")
    java.util.Optional<Project> findForWorkspaceCreation(@org.springframework.data.repository.query.Param("id") Long id);

    @org.springframework.data.jpa.repository.Query("""
            select p.id as id, p.teamId as teamId, parent.id as parentProjectId
              from Project p left join p.parentProject parent
             where p.id = :id and p.tenantId = :tenantId and p.isActive = true
            """)
    java.util.Optional<CompletionScope> findCompletionScope(
            @org.springframework.data.repository.query.Param("id") Long id,
            @org.springframework.data.repository.query.Param("tenantId") Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Project p where p.id = :id and p.tenantId = :tenantId and p.isActive = true")
    java.util.Optional<Project> lockForCompletion(
            @org.springframework.data.repository.query.Param("id") Long id,
            @org.springframework.data.repository.query.Param("tenantId") Long tenantId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Project p where p.parentProject.id = :parentId and p.isActive = true order by p.id")
    java.util.List<Project> lockChildrenForCompletion(
            @org.springframework.data.repository.query.Param("parentId") Long parentId);

    interface CompletionScope {
        Long getId();
        Long getTeamId();
        Long getParentProjectId();
    }

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("update Project p set p.status = com.example.starter_project_2025.system.project.domain.ProjectStatus.ACTIVE where p.status = com.example.starter_project_2025.system.project.domain.ProjectStatus.PLANNING and exists (select w.id from Workspace w where w.project.id = p.id and w.status = com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus.ACTIVE)")
    int activateProjectsWithWorkspace();

    java.util.List<Project> findAllByTenantIdAndIdInAndIsActiveTrueOrderByNameAsc(
            Long tenantId,
            java.util.Collection<Long> ids
    );
}
