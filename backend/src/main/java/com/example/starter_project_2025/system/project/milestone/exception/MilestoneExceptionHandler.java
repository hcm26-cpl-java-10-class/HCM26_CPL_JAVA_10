package com.example.starter_project_2025.system.project.milestone.exception;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.milestone.controller.MilestoneController;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.*;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = {MilestoneController.class,
        com.example.starter_project_2025.system.project.milestone.submission.controller.ArtifactSubmissionController.class,
        com.example.starter_project_2025.system.project.milestone.submission.controller.TeamArtifactSubmissionController.class,
        com.example.starter_project_2025.system.project.milestone.risk.MilestoneRiskController.class})
public class MilestoneExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<MilestoneErrorResponse> handleBeanValidation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(fieldError.getField(), ignored -> new ArrayList<>())
                    .add(fieldError.getDefaultMessage());
        }
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", errors);
    }

    @ExceptionHandler(MilestoneValidationException.class)
    public ResponseEntity<MilestoneErrorResponse> handleMilestoneValidation(MilestoneValidationException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", ex.getErrors());
    }

    @ExceptionHandler(MissingRequestHeaderException.class)
    public ResponseEntity<MilestoneErrorResponse> handleMissingHeader(MissingRequestHeaderException ex) {
        Map<String, List<String>> errors = Map.of(
                "idempotencyKey", List.of("Idempotency-Key header is required")
        );
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone data is invalid", errors);
    }

    @ExceptionHandler(MilestoneConflictException.class)
    public ResponseEntity<MilestoneErrorResponse> handleConflict(MilestoneConflictException ex) {
        return error(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<MilestoneErrorResponse> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "ACCESS_DENIED",
                "You do not have permission to access this project", Map.of());
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<MilestoneErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        String field = ex.getName();
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Milestone query is invalid", Map.of(field, List.of(field + " has an invalid value")));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<MilestoneErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(MilestoneDependencyException.class)
    public ResponseEntity<MilestoneErrorResponse> handleDependencyError(MilestoneDependencyException ex) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "MILESTONE_DEPENDENCY_ERROR",
                "Milestone detail could not be loaded", Map.of());
    }

    @ExceptionHandler(com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactUploadRejectedException.class)
    public ResponseEntity<MilestoneErrorResponse> artifactRejected(RuntimeException ex) {
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "ARTIFACT_UPLOAD_REJECTED", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(com.example.starter_project_2025.system.project.milestone.submission.service.ArtifactUploadUnavailableException.class)
    public ResponseEntity<MilestoneErrorResponse> artifactScannerUnavailable(RuntimeException ex) {
        return error(HttpStatus.SERVICE_UNAVAILABLE, "ARTIFACT_UPLOAD_UNAVAILABLE",
                "File upload is temporarily unavailable because validation services are not ready", Map.of());
    }

    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<MilestoneErrorResponse> uploadTooLarge(Exception ex) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "ARTIFACT_FILE_TOO_LARGE",
                "File exceeds the configured upload limit", Map.of("file", List.of("Choose a smaller file")));
    }

    private ResponseEntity<MilestoneErrorResponse> error(
            HttpStatus status,
            String code,
            String message,
            Map<String, List<String>> errors
    ) {
        return ResponseEntity.status(status).body(new MilestoneErrorResponse(
                status.value(), code, message, errors,
                CorrelationIdFilter.currentId(), Instant.now()
        ));
    }

    @ExceptionHandler(org.springframework.security.authentication.AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<MilestoneErrorResponse> unauthenticated(Exception ex) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "Please sign in", Map.of());
    }
    @ExceptionHandler({org.springframework.dao.DataIntegrityViolationException.class,
            org.springframework.dao.ConcurrencyFailureException.class})
    public ResponseEntity<MilestoneErrorResponse> concurrent(Exception ex) {
        return error(HttpStatus.CONFLICT, "CONFLICT", "Milestone data changed. Reload and try again.", Map.of());
    }

    @ExceptionHandler({IllegalStateException.class, org.springframework.dao.DataAccessException.class})
    public ResponseEntity<MilestoneErrorResponse> internal(Exception ex) {
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "MILESTONE_SYSTEM_ERROR",
                "Milestone request could not be completed. Please try again.", Map.of());
    }

}
