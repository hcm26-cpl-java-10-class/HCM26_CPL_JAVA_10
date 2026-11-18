package com.example.starter_project_2025.system.subject;

import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import org.hibernate.exception.ConstraintViolationException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.Locale;
import java.util.Map;

/** Handles database conflicts that can still occur after the duplicate pre-check. */
@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = SubjectController.class)
public class SubjectExceptionHandler {
    static final String DUPLICATE_MESSAGE =
            "A subject with this code and version already exists. Refresh the list or choose a different version.";

    static boolean isDuplicateIdentity(Throwable error) {
        for (Throwable cause = error; cause != null; cause = cause.getCause()) {
            if (cause instanceof ConstraintViolationException violation) {
                String constraint = violation.getConstraintName();
                if (constraint != null && constraint.toLowerCase(Locale.ROOT).contains("uk_subject_code_version")) {
                    return true;
                }
            }
        }
        return false;
    }

    static String persistenceMessage(DataIntegrityViolationException error) {
        return isDuplicateIdentity(error) ? DUPLICATE_MESSAGE
                : "Subject could not be saved. Check required fields and field lengths.";
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ValidationErrorResponse> handleIntegrityViolation(DataIntegrityViolationException error) {
        boolean duplicate = isDuplicateIdentity(error);
        return ResponseEntity.status(duplicate ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST)
                .body(new ValidationErrorResponse(persistenceMessage(error),
                        duplicate ? Map.of("code", List.of(DUPLICATE_MESSAGE)) : Map.of()));
    }
}
