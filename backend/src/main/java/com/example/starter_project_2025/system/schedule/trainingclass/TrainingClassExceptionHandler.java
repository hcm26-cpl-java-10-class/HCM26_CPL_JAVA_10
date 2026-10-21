package com.example.starter_project_2025.system.schedule.trainingclass;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.http.converter.HttpMessageNotReadableException;
import com.fasterxml.jackson.databind.JsonMappingException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestControllerAdvice(assignableTypes = TrainingClassController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
@RequiredArgsConstructor
public class TrainingClassExceptionHandler {
    private final TrainingClassRepository repository;

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> invalidCapacity(HttpMessageNotReadableException exception) {
        if (exception.getCause() instanceof JsonMappingException mapping
                && mapping.getPath().stream().anyMatch(path -> "capacity".equals(path.getFieldName()))) {
            String message = "Capacity must be a whole number from 1 to 50";
            return ResponseEntity.badRequest().body(Map.of("message", message, "errors", Map.of("capacity", List.of(message))));
        }
        throw exception;
    }

    @ExceptionHandler(TrainingClassConflictException.class)
    public ResponseEntity<Map<String, Object>> conflict(TrainingClassConflictException exception) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", exception.getMessage());
        body.put("errors", exception.getErrors());
        if (exception.getCurrentVersion() != null) {
            body.put("currentVersion", exception.getCurrentVersion());
        }
        return ResponseEntity.status(409).body(body);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> duplicateCode(DataIntegrityViolationException exception) {
        // The database remains authoritative when concurrent creates pass the pre-check.
        String detail = String.valueOf(exception.getMostSpecificCause().getMessage())
                .toLowerCase(Locale.ROOT);
        if (!detail.contains("uk_training_class_code")) {
            throw exception;
        }
        return conflict(TrainingClassConflictException.duplicateCode());
    }

    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<Map<String, Object>> stale(ObjectOptimisticLockingFailureException exception) {
        Long currentVersion = null;
        if (exception.getPersistentClass() == TrainingClass.class && exception.getIdentifier() instanceof Long id) {
            currentVersion = repository.findById(id).map(TrainingClass::getVersion).orElse(null);
        }
        String message = "This class was changed by another user. Reload it before saving.";
        return conflict(new TrainingClassConflictException(
                message, Map.of("version", List.of(message)), currentVersion));
    }
}
