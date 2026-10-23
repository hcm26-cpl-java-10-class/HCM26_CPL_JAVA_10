package com.example.starter_project_2025.system.project.sprint;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.Project;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface SprintRepository extends BaseCrudRepository<Sprint, Long> {

    Optional<Sprint> findByProjectAndName(Project project, String name);

    boolean existsByProjectIdAndName(Long projectId, String name);

    boolean existsByProjectIdAndNameAndIdNot(Long projectId, String name, Long id);
}
