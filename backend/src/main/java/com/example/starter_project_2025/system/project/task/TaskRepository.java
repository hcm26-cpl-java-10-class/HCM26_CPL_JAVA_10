package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository("taskRepository")
public interface TaskRepository extends BaseCrudRepository<Task, UUID> {
    Optional<Task> findByIdAndIsActiveTrue(UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select task from ProjectTask task where task.projectId = :projectId order by task.id")
    List<Task> lockProjectTasks(@Param("projectId") UUID projectId);
}
