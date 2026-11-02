package com.example.starter_project_2025.system.project.resources;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectResourceRepository extends JpaRepository<ProjectResource, Long> {
    @EntityGraph(attributePaths = "project")
    List<ProjectResource> findAllByTenantIdAndProject_IdInAndIsActiveTrueOrderByIdAsc(
            Long tenantId, Collection<Long> projectIds);
}
