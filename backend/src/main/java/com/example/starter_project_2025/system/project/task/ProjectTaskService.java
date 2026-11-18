package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.system.project.board.TaskCardResponse;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;

import java.util.List;

public interface ProjectTaskService {

    List<ProjectTaskAssigneeResponse> getAssignees(Long projectId);

    TaskCardResponse createTask(Long projectId, Long sprintId, CreateTaskRequest request);

    TaskCardResponse updateTask(Long projectId, Long taskId, UpdateTaskRequest request);

    void deleteTask(Long projectId, Long taskId);

    ProjectTaskListResponse getTaskList(
            Long projectId,
            Long sprintId,
            TaskStatus status,
            Long assigneeProjectMemberId,
            Boolean unassigned,
            String search,
            int page,
            int size,
            String sortBy,
            String direction
    );

    TaskStatusUpdateResponse updateStatus(Long projectId, Long taskId, TaskStatusUpdateRequest request);

    TaskStatusUpdateResponse moveTaskToSprint(Long projectId, Long taskId, MoveTaskToSprintRequest request);

    TaskStatusUpdateResponse assignTask(Long projectId, Long taskId, AssignTaskRequest request);

    TaskStatusUpdateResponse updateTaskOrder(Long projectId, Long taskId, UpdateTaskOrderRequest request);

    List<TaskStatusHistoryResponse> getStatusHistory(Long projectId, Long taskId);
}
