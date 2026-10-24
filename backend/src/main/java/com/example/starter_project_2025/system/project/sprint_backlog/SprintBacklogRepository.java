package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SprintBacklogRepository extends BaseCrudRepository<SprintBacklog, Long> {

    List<SprintBacklog> findBySprintIdOrderByIdAsc(Long sprintId);

    long countBySprintId(Long sprintId);
}
