package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.project.board.TaskCardResponse;
import com.example.starter_project_2025.system.project.sprint.TaskStatus;
import jakarta.validation.Valid;
import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/projects/{projectId}")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ProjectTaskController {

    ProjectTaskService projectTaskService;

    @GetMapping("/task-assignees")
    public ResponseEntity<List<ProjectTaskAssigneeResponse>> getAssignees(
            @PathVariable Long projectId
    ) {
        return ResponseEntity.ok(projectTaskService.getAssignees(projectId));
    }

    @GetMapping("/tasks")
    public ResponseEntity<ProjectTaskListResponse> getTasks(
            @PathVariable Long projectId,
            @RequestParam(required = false) Long sprintId,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) Long assigneeProjectMemberId,
            @RequestParam(required = false) Boolean unassigned,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "code") String sortBy,
            @RequestParam(defaultValue = "ASC") String direction
    ) {
        return ResponseEntity.ok(projectTaskService.getTaskList(
                projectId,
                sprintId,
                status,
                assigneeProjectMemberId,
                unassigned,
                search,
                page,
                size,
                sortBy,
                direction
        ));
    }

    @PostMapping("/sprints/{sprintId}/tasks")
    public ResponseEntity<TaskCardResponse> createTask(
            @PathVariable Long projectId,
            @PathVariable Long sprintId,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(projectTaskService.createTask(projectId, sprintId, request));
    }

    @PatchMapping("/tasks/{taskId}/status")
    public ResponseEntity<TaskStatusUpdateResponse> updateStatus(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @Valid @RequestBody TaskStatusUpdateRequest request
    ) {
        return ResponseEntity.ok(projectTaskService.updateStatus(projectId, taskId, request));
    }

    @PatchMapping("/tasks/{taskId}/sprint")
    public ResponseEntity<TaskStatusUpdateResponse> moveTaskToSprint(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @Valid @RequestBody MoveTaskToSprintRequest request
    ) {
        return ResponseEntity.ok(projectTaskService.moveTaskToSprint(projectId, taskId, request));
    }

    @PatchMapping("/tasks/{taskId}/assignee")
    public ResponseEntity<TaskStatusUpdateResponse> assignTask(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @Valid @RequestBody AssignTaskRequest request
    ) {
        return ResponseEntity.ok(projectTaskService.assignTask(projectId, taskId, request));
    }

    @PatchMapping("/tasks/{taskId}/order")
    public ResponseEntity<TaskStatusUpdateResponse> updateTaskOrder(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskOrderRequest request
    ) {
        return ResponseEntity.ok(projectTaskService.updateTaskOrder(projectId, taskId, request));
    }

    @PutMapping("/tasks/{taskId}")
    public ResponseEntity<TaskCardResponse> updateTask(
            @PathVariable Long projectId,
            @PathVariable Long taskId,
            @Valid @RequestBody UpdateTaskRequest request
    ) {
        return ResponseEntity.ok(projectTaskService.updateTask(projectId, taskId, request));
    }

    @DeleteMapping("/tasks/{taskId}")
    public ResponseEntity<Void> deleteTask(
            @PathVariable Long projectId,
            @PathVariable Long taskId
    ) {
        projectTaskService.deleteTask(projectId, taskId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/tasks/{taskId}/status-history")
    public ResponseEntity<List<TaskStatusHistoryResponse>> getStatusHistory(
            @PathVariable Long projectId,
            @PathVariable Long taskId
    ) {
        return ResponseEntity.ok(projectTaskService.getStatusHistory(projectId, taskId));
    }

    @ExceptionHandler(TaskConflictException.class)
    public ResponseEntity<TaskConflictResponse> handleTaskConflict(TaskConflictException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new TaskConflictResponse(
                exception.getMessage(),
                exception.getCurrentVersion(),
                exception.getCurrentStatus()
        ));
    }

    @ExceptionHandler(TaskValidationException.class)
    public ResponseEntity<ValidationErrorResponse> handleTaskValidation(TaskValidationException exception) {
        return ResponseEntity.unprocessableEntity().body(
                new ValidationErrorResponse("Task validation failed", exception.getErrors())
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleRequestValidation(
            MethodArgumentNotValidException exception
    ) {
        Map<String, List<String>> errors = new HashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(fieldError.getField(), ignored -> new ArrayList<>())
                    .add(fieldError.getDefaultMessage());
        }
        return ResponseEntity.unprocessableEntity().body(
                new ValidationErrorResponse("Task validation failed", errors)
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ValidationErrorResponse> handleUnreadableRequest() {
        return ResponseEntity.unprocessableEntity().body(
                new ValidationErrorResponse(
                        "Task validation failed",
                        Map.of("status", List.of("Trạng thái phải là TODO, IN_PROGRESS, REVIEW, DONE hoặc BLOCKED"))
                )
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ValidationErrorResponse> handleInvalidQueryParameter(
            MethodArgumentTypeMismatchException exception
    ) {
        return ResponseEntity.unprocessableEntity().body(
                new ValidationErrorResponse(
                        "Task query validation failed",
                        Map.of(exception.getName(), List.of("Giá trị tham số không hợp lệ"))
                )
        );
    }
}
