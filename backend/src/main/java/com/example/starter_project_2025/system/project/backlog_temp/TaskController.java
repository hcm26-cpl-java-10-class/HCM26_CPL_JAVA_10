package com.example.starter_project_2025.system.project.backlog_temp;

import com.example.starter_project_2025.base.crud.controller.BaseCrudDataIoController;
import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.project.backlog_temp.audit.TaskAuditLogDTO;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/tasks")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Task", description = "APIs for managing backlog items (temporary module)")
public class TaskController
        extends BaseCrudDataIoController<Task, Long, TaskDTO, TaskFilter> {

    TaskService taskService;
    TaskRepository taskRepository;
    MilestoneLookup milestoneLookup;

    @Override
    protected BaseCrudService<Long, TaskDTO, TaskFilter> getService() {
        return taskService;
    }

    @Override
    protected BaseCrudRepository<Task, Long> getRepository() {
        return taskRepository;
    }

    @Override
    protected Class<Task> getEntityClass() {
        return Task.class;
    }

    /**
     * Audit trail of a backlog item (actor, timestamp, before/after state,
     * correlation id) - UFR-PRJ-003-02.
     */
    @GetMapping("/{id}/audit-logs")
    public ResponseEntity<List<TaskAuditLogDTO>> getAuditLogs(@PathVariable Long id) {
        return ResponseEntity.ok(taskService.getAuditLogs(id));
    }

    /**
     * Milestones a backlog item can be linked to (AC01). Cancelled milestones
     * are excluded so the selector only offers valid options; a stale selection
     * is still rejected with 404 by the create/update use case (AC03).
     */
    @GetMapping("/milestone-options")
    @PreAuthorize("hasAuthority('TASK_READ')")
    public ResponseEntity<List<MilestoneOptionDTO>> getMilestoneOptions(
            @RequestParam(required = false) Long projectId
    ) {
        return ResponseEntity.ok(milestoneLookup.listLinkable(projectId));
    }

    // ---------------------------------------------------------------------
    // Use-case specific error mapping (kept local to the backlog module so the
    // global handler contract used by other modules is untouched).
    // ---------------------------------------------------------------------

    /**
     * AC02: missing / too long name or description answers
     * {@code 422 Unprocessable Entity} with a per-field error map, so the UI
     * can highlight the inputs and keep the other form values.
     */
    @ExceptionHandler(TaskValidationException.class)
    public ResponseEntity<ValidationErrorResponse> handleTaskValidation(TaskValidationException ex) {
        ValidationErrorResponse body = new ValidationErrorResponse(
                "Dữ liệu Backlog item không hợp lệ",
                ex.getErrors()
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    /**
     * AC03: the selected milestone was cancelled / removed (or belongs to
     * another project) answers {@code 404 Not Found}.
     */
    @ExceptionHandler(TaskMilestoneNotFoundException.class)
    public ResponseEntity<ValidationErrorResponse> handleMilestoneNotFound(TaskMilestoneNotFoundException ex) {
        ValidationErrorResponse body = new ValidationErrorResponse(
                ex.getMessage(),
                ex.getErrors()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }
}
