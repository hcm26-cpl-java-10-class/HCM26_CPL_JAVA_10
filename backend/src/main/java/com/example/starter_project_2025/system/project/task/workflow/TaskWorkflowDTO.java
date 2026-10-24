package com.example.starter_project_2025.system.project.task.workflow;

import com.example.starter_project_2025.system.project.task.TaskDTO;
import com.example.starter_project_2025.system.project.task.TaskStatus;
import com.example.starter_project_2025.system.project.task.dependency.TaskDependencyDTO;

import java.util.List;

public record TaskWorkflowDTO(TaskDTO task, List<TaskStatus> allowedTransitions,
                              List<TaskDependencyDTO> predecessors, List<TaskDependencyDTO> successors,
                              boolean editable, boolean deletable) {
}
