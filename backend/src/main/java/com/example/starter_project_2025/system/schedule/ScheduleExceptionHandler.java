package com.example.starter_project_2025.system.schedule;

import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(-10)
@RestControllerAdvice
public class ScheduleExceptionHandler {
    @ExceptionHandler(ScheduleValidationException.class)
    public ResponseEntity<ScheduleValidationResult> invalid(ScheduleValidationException ex) {
        return ResponseEntity.status(409).body(ex.getResult());
    }
}
