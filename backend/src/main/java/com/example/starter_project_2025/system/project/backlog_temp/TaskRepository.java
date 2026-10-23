package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TaskRepository extends BaseCrudRepository<Task, Long> {

    Optional<Task> findByProjectIdAndTitleIgnoreCase(Long projectId, String title);

    List<Task> findByProjectId(Long projectId);

    List<Task> findBySprintId(Long sprintId);

    long countByStatus(TaskStatus status);
}
