package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ProjectRepository extends BaseCrudRepository<Project, Long> {

    Optional<Project> findByName(String name);
}
