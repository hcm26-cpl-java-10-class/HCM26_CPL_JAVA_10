package com.example.starter_project_2025.system.project.task.dependency;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TaskDependencyRepository extends JpaRepository<TaskDependency, TaskDependencyId> {
    List<TaskDependency> findBySuccessorTaskIdOrderByCreatedAtAsc(UUID taskId);

    List<TaskDependency> findByPredecessorTaskIdOrderByCreatedAtAsc(UUID taskId);

    List<TaskDependency> findBySuccessorTaskProjectId(UUID projectId);
}
