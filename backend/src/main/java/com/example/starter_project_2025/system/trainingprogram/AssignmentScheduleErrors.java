package com.example.starter_project_2025.system.trainingprogram;

import org.springframework.core.annotation.Order;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestControllerAdvice
@Order(-20)
public class AssignmentScheduleErrors {
    @ExceptionHandler(AssignmentScheduleValidation.Rejected.class)
    public ResponseEntity<?> rejected(AssignmentScheduleValidation.Rejected error) {
        return ResponseEntity.status(409).body(Map.of("message",error.getMessage(),"errors",Map.of(),
                "valid",false,"issues",error.result().issues()));
    }
}
