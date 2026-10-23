package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface TaskRepository extends BaseCrudRepository<Task, UUID> {
    Optional<Task> findByIdAndIsActiveTrue(UUID id);
}
