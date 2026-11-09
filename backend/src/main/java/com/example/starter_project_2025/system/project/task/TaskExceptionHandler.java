package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.task.workflow.TaskWorkflowController;
import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.PessimisticLockException;
import jakarta.persistence.LockTimeoutException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.LinkedHashMap;

@Slf4j
@RestControllerAdvice(assignableTypes = {TaskController.class, TaskWorkflowController.class,
        com.example.starter_project_2025.system.project.task.backlog.BacklogSubtaskController.class,
        com.example.starter_project_2025.system.project.task.alert.TaskAlertController.class,
        com.example.starter_project_2025.system.project.task.reminder.MemberReminderController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TaskExceptionHandler {
    @ExceptionHandler(com.example.starter_project_2025.system.project.task.reminder.MemberReminderCooldownException.class)
    public ResponseEntity<com.example.starter_project_2025.system.project.task.reminder.MemberReminderDtos.CooldownError> cooldown(
            com.example.starter_project_2025.system.project.task.reminder.MemberReminderCooldownException ex) {
        return ResponseEntity.unprocessableEntity().header("X-Correlation-ID",TaskRequestContext.currentCorrelationId())
                .body(new com.example.starter_project_2025.system.project.task.reminder.MemberReminderDtos.CooldownError(
                        ex.getMessage(),ex.getErrors(),ex.getMembers()));
    }

    @ExceptionHandler(TaskValidationException.class)
    public ResponseEntity<ValidationErrorResponse> validation(TaskValidationException ex) {
        return ResponseEntity.unprocessableEntity().header("X-Correlation-ID", TaskRequestContext.currentCorrelationId())
                .body(new ValidationErrorResponse(ex.getMessage(), ex.getErrors()));
    }

    @ExceptionHandler(TaskConflictException.class)
    public ResponseEntity<ErrorResponse> conflict(TaskConflictException ex) {
        return error(409, ex.getMessage());
    }

    @ExceptionHandler({OptimisticLockingFailureException.class, OptimisticLockException.class})
    public ResponseEntity<ErrorResponse> stale(Exception ex) {
        return error(409, TaskConflictException.STALE_MESSAGE);
    }

    @ExceptionHandler({PessimisticLockingFailureException.class, PessimisticLockException.class, LockTimeoutException.class})
    public ResponseEntity<ErrorResponse> busy(Exception ex) {
        return error(409, "This task is being updated. Please retry with the same Idempotency-Key");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> concurrentWrite(DataIntegrityViolationException ex) {
        return error(409, "The data has changed. Please retry with the same Idempotency-Key");
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ErrorResponse> unauthenticated(AuthenticationCredentialsNotFoundException ex) {
        return error(401, "Please sign in");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> forbidden(AccessDeniedException ex) {
        return error(403, "You do not have permission to perform this task action");
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> notFound(ResourceNotFoundException ex) {
        return error(404, ex.getMessage());
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ValidationErrorResponse> invalidFilter(BindException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        ex.getFieldErrors().forEach(field -> errors.put(field.getField(), List.of("Invalid value")));
        return validation(new TaskValidationException(errors));
    }

    @ExceptionHandler({MethodArgumentTypeMismatchException.class, MissingServletRequestParameterException.class})
    public ResponseEntity<ErrorResponse> invalidParameter(Exception ex) {
        return error(400, "Invalid request parameter");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ValidationErrorResponse> invalidBody(HttpMessageNotReadableException ex) {
        String field = "request";
        Throwable cause = ex.getCause();
        if (cause instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
            String name = mapping.getPath().getFirst().getFieldName();
            if (name != null) {
                field = name;
            }
        }
        String message = switch (field) {
            case "estimatedHours" -> "Estimate must be a valid number greater than 0";
            case "title" -> "Task title must contain 1 to 250 characters";
            case "priority" -> "Priority must be High, Medium or Low";
            case "status" -> "Please select a valid task status";
            case "backlogItemId" -> "Backlog item ID must be a positive whole number";
            case "version" -> "Task version must be a non-negative whole number";
            case "tags" -> "Tags must be a list of text values";
            case "projectId", "sprintId", "milestoneId", "assigneeProjectMemberId" ->
                    "Please provide a valid ID";
            default -> "Invalid request data";
        };
        return validation(new TaskValidationException(field, message));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> unexpected(Exception ex) {
        String correlationId = TaskRequestContext.currentCorrelationId();
        log.error("Task request failed, correlationId={}", correlationId, ex);
        return ResponseEntity.internalServerError().header("X-Correlation-ID", correlationId)
                .body(new ErrorResponse(500, "Unable to process task request", LocalDateTime.now()));
    }

    private ResponseEntity<ErrorResponse> error(int status, String message) {
        return ResponseEntity.status(status).header("X-Correlation-ID", TaskRequestContext.currentCorrelationId())
                .body(new ErrorResponse(status, message, LocalDateTime.now()));
    }
}
