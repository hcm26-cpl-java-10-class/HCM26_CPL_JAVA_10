package com.example.starter_project_2025.system.exam.review.controller;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewErrorResponse;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewConflictException;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewForbiddenException;
import com.example.starter_project_2025.system.exam.review.service.ExamReviewValidationException;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.validation.FieldError;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Mapping loi rieng cho workflow tu danh gia / danh gia cheo theo SRS:
 * 403 (khong du quyen), 404 (khong ton tai), 409 (trung / sai transition), 422 (du lieu khong hop le).
 */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = ExamPeerReviewController.class)
public class ExamPeerReviewExceptionHandler {

    @ExceptionHandler(ExamReviewValidationException.class)
    ResponseEntity<ExamReviewErrorResponse> validation(ExamReviewValidationException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        errors.put(ex.getField(), List.of(ex.getMessage()));
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED", ex.getMessage(), errors);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ExamReviewErrorResponse> beanValidation(MethodArgumentNotValidException ex) {
        Map<String, List<String>> errors = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            errors.computeIfAbsent(error.getField(), ignored -> new ArrayList<>())
                    .add(error.getDefaultMessage());
        }
        return error(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDATION_FAILED",
                "Review data is invalid", errors);
    }

    @ExceptionHandler(ExamReviewConflictException.class)
    ResponseEntity<ExamReviewErrorResponse> conflict(ExamReviewConflictException ex) {
        return error(HttpStatus.CONFLICT, "CONFLICT", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(ExamReviewForbiddenException.class)
    ResponseEntity<ExamReviewErrorResponse> forbidden(ExamReviewForbiddenException ex) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", ex.getMessage(), Map.of());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ExamReviewErrorResponse> notFound(ResourceNotFoundException ex) {
        return error(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", ex.getMessage(), Map.of());
    }

    private ResponseEntity<ExamReviewErrorResponse> error(HttpStatus status,
                                                          String code,
                                                          String message,
                                                          Map<String, List<String>> errors) {
        return ResponseEntity.status(status).body(new ExamReviewErrorResponse(
                status.value(), code, message, errors,
                CorrelationIdFilter.currentId(), Instant.now()));
    }
}
