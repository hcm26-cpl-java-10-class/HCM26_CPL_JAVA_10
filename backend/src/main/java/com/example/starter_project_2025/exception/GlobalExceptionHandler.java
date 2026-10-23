package com.example.starter_project_2025.exception;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.example.starter_project_2025.system.project.StudentAlreadyAssignedException;
import com.example.starter_project_2025.system.project.AllocationSessionConflictException;
import com.example.starter_project_2025.system.project.IdempotencyKeyConflictException;
import com.example.starter_project_2025.system.project.IdempotencyRequestInProgressException;
import com.example.starter_project_2025.system.project.TeamCapacityExceededException;
import com.example.starter_project_2025.system.project.TeamErrorResponse;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.security.authentication.LockedException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AllocationSessionConflictException.class)
    public ResponseEntity<TeamErrorResponse> handleAllocationSessionConflict(
            AllocationSessionConflictException ex
    ) {
        TeamErrorResponse response = new TeamErrorResponse(
                HttpStatus.CONFLICT.value(),
                "ERR_ALLOCATION_SESSION_CONFLICT",
                ex.getMessage(),
                null,
                null,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(IdempotencyKeyConflictException.class)
    public ResponseEntity<TeamErrorResponse> handleIdempotencyKeyConflict(
            IdempotencyKeyConflictException ex
    ) {
        TeamErrorResponse response = new TeamErrorResponse(
                HttpStatus.CONFLICT.value(),
                "ERR_IDEMPOTENCY_KEY_REUSED",
                ex.getMessage(),
                null,
                null,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(IdempotencyRequestInProgressException.class)
    public ResponseEntity<TeamErrorResponse> handleIdempotencyRequestInProgress(
            IdempotencyRequestInProgressException ex
    ) {
        TeamErrorResponse response = new TeamErrorResponse(
                HttpStatus.CONFLICT.value(),
                "ERR_REQUEST_IN_PROGRESS",
                ex.getMessage(),
                null,
                null,
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(TeamCapacityExceededException.class)
    public ResponseEntity<TeamErrorResponse> handleTeamCapacityExceeded(
            TeamCapacityExceededException ex
    ) {
        TeamErrorResponse response = new TeamErrorResponse(
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "ERR_TEAM_CAPACITY_EXCEEDED",
                ex.getMessage(),
                null,
                null,
                LocalDateTime.now()
        );
        return ResponseEntity.unprocessableEntity().body(response);
    }

    @ExceptionHandler(StudentAlreadyAssignedException.class)
    public ResponseEntity<TeamErrorResponse> handleStudentAlreadyAssigned(
            StudentAlreadyAssignedException ex
    ) {
        TeamErrorResponse response = new TeamErrorResponse(
                HttpStatus.CONFLICT.value(),
                "ERR_STUDENT_ALREADY_ASSIGNED",
                ex.getMessage(),
                ex.getMemberId(),
                ex.getConflictingTeamId(),
                LocalDateTime.now()
        );
        return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleResourceNotFoundException(ResourceNotFoundException ex) {
        log.warn("[404] ResourceNotFound: {}", ex.getMessage());
        ErrorResponse error = new ErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                ex.getMessage(),
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(BadRequestException.class)
    public ResponseEntity<ErrorResponse> handleBadRequestException(BadRequestException ex) {
        log.warn("[400] BadRequest: {}", ex.getMessage());
        ErrorResponse error = new ErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                ex.getMessage(),
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }


    @ExceptionHandler(LockedException.class)
    public ResponseEntity<ErrorResponse> handleLockedException(
            LockedException ex) {

        ErrorResponse error = new ErrorResponse(
                HttpStatus.FORBIDDEN.value(),
                "Account is locked",
                LocalDateTime.now()
        );

        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }


    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ErrorResponse> handleBadCredentialsException(BadCredentialsException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.UNAUTHORIZED.value(),
                "Invalid email or password",
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.UNAUTHORIZED);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDeniedException(AccessDeniedException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.FORBIDDEN.value(),
                "You don't have permission to access this resource",
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.FORBIDDEN);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ValidationErrorResponse> handleValidation(MethodArgumentNotValidException ex) {

        Map<String, List<String>> errors = new HashMap<>();

        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {

            errors.computeIfAbsent(
                    fieldError.getField(),
                    key -> new ArrayList<>()
            ).add(fieldError.getDefaultMessage());
        }

        ValidationErrorResponse response = new ValidationErrorResponse(
                "Validation failed",
                errors
        );

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ValidationErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {

        Map<String, List<String>> errors = new HashMap<>();

        for (ConstraintViolation<?> violation : ex.getConstraintViolations()) {

            String field = violation.getPropertyPath().toString();

            errors.computeIfAbsent(field, k -> new ArrayList<>())
                    .add(violation.getMessage());
        }

        ValidationErrorResponse response =
                new ValidationErrorResponse("Validation failed", errors);

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(BusinessValidationException.class)
    public ResponseEntity<ValidationErrorResponse> handleBusiness(BusinessValidationException ex) {

        ValidationErrorResponse response =
                new ValidationErrorResponse("Validation failed", ex.getErrors());

        return ResponseEntity.badRequest().body(response);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGlobalException(Exception ex) {
        ex.printStackTrace();
        String message = ex.getMessage() != null ? ex.getMessage() : ex.getClass().getSimpleName();
        ErrorResponse error = new ErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "An unexpected error occurred: " + message,
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> handleIllegalArgumentException(IllegalArgumentException ex) {
        ErrorResponse error = new ErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                ex.getMessage(),
                LocalDateTime.now());
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(com.example.starter_project_2025.system.external_api.exception.ExternalApiException.class)
    public ResponseEntity<ErrorResponse> handleExternalApiException(
            com.example.starter_project_2025.system.external_api.exception.ExternalApiException ex) {
        log.error("[ExternalAPI] {}", ex.getMessage());

        int status = ex.getStatusCode() > 0 ? ex.getStatusCode() : HttpStatus.SERVICE_UNAVAILABLE.value();
        HttpStatus httpStatus = HttpStatus.resolve(status);
        if (httpStatus == null) {
            httpStatus = HttpStatus.SERVICE_UNAVAILABLE;
        }

        ErrorResponse error = new ErrorResponse(
                httpStatus.value(),
                ex.getMessage(),
                LocalDateTime.now());
        return new ResponseEntity<>(error, httpStatus);
    }
}
