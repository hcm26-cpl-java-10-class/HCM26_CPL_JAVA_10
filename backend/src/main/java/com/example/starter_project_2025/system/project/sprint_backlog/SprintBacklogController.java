package com.example.starter_project_2025.system.project.sprint_backlog;

import com.example.starter_project_2025.base.crud.controller.BaseCrudController;
import com.example.starter_project_2025.base.crud.service.BaseCrudService;
import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.project.sprint_backlog.audit.SprintBacklogAuditLogDTO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.persistence.OptimisticLockException;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

/**
 * CRUD API of the Sprint Backlog items.
 * <p>
 * The generic endpoints (page / get by id / create / update / delete) come from
 * {@link BaseCrudController}; the module only adds the sprint-scoped listing and
 * the audit trail, plus its own error mapping.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/sprint-backlogs")
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@Tag(name = "Sprint Backlog", description = "APIs for managing sprint backlog items")
public class SprintBacklogController
        extends BaseCrudController<Long, SprintBacklogDTO, SprintBacklogFilter> {

    SprintBacklogService sprintBacklogService;

    @Override
    protected BaseCrudService<Long, SprintBacklogDTO, SprintBacklogFilter> getService() {
        return sprintBacklogService;
    }

    /**
     * Every backlog item of one sprint (a sprint has one or many backlog
     * items).
     */
    @GetMapping("/by-sprint/{sprintId}")
    public ResponseEntity<List<SprintBacklogDTO>> getBySprint(@PathVariable Long sprintId) {
        return ResponseEntity.ok(sprintBacklogService.getBySprintId(sprintId));
    }

    /**
     * Audit trail of a backlog item (actor, timestamp, before/after state,
     * correlation id).
     */
    @GetMapping("/{id}/audit-logs")
    public ResponseEntity<List<SprintBacklogAuditLogDTO>> getAuditLogs(@PathVariable Long id) {
        return ResponseEntity.ok(sprintBacklogService.getAuditLogs(id));
    }

    // ---------------------------------------------------------------------
    // Use-case specific error mapping (kept local to the sprint backlog
    // module so the global handler contract used by other modules is
    // untouched).
    // ---------------------------------------------------------------------

    @ExceptionHandler(SprintBacklogValidationException.class)
    public ResponseEntity<ValidationErrorResponse> handleSprintBacklogValidation(
            SprintBacklogValidationException ex) {
        ValidationErrorResponse body = new ValidationErrorResponse("Dữ liệu không hợp lệ", ex.getErrors());
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    @ExceptionHandler(SprintBacklogConflictException.class)
    public ResponseEntity<ErrorResponse> handleSprintBacklogConflict(SprintBacklogConflictException ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                ex.getMessage(),
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<ErrorResponse> handleOptimisticLock(Exception ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                SprintBacklogConflictException.DEFAULT_MESSAGE,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleDataIntegrityViolation(DataIntegrityViolationException ex) {
        ErrorResponse body = new ErrorResponse(
                HttpStatus.CONFLICT.value(),
                "Dữ liệu Sprint Backlog vi phạm ràng buộc dữ liệu",
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }
}
