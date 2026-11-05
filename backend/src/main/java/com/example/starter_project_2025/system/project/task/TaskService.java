package com.example.starter_project_2025.system.project.task;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.UUID;

public interface TaskService {
    Page<TaskDTO> getAll(Pageable pageable, String search, TaskFilter filter);

    TaskDTO getById(UUID id);

    TaskDTO create(TaskDTO request, TaskRequestContext context);

    TaskDTO update(UUID id, TaskDTO request, TaskRequestContext context);

    List<String> getTags(UUID projectId, String search);
}
