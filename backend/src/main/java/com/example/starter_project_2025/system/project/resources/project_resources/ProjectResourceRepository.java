package com.example.starter_project_2025.system.project.resources.project_resources;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ProjectResourceRepository extends BaseCrudRepository<ProjectResource, Long> {

    List<ProjectResource> findAllByProjectIdOrderByOrderIndexAscIdAsc(Long projectId);

    List<ProjectResource> findAllByProjectIdAndIsActiveTrueOrderByOrderIndexAscIdAsc(Long projectId);

    List<ProjectResource> findAllByProjectIdInOrderByOrderIndexAscIdAsc(java.util.Collection<Long> projectIds);

    long countByProjectId(Long projectId);
}
