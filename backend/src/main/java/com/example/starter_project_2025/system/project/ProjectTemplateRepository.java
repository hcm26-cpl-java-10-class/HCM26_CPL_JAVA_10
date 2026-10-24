package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectTemplateRepository
        extends BaseCrudRepository<ProjectTemplate, Long> {

    Optional<ProjectTemplate> findByIdAndIsActiveTrue(Long id);

    Optional<ProjectTemplate> findByCodeAndIsActiveTrue(String code);
}