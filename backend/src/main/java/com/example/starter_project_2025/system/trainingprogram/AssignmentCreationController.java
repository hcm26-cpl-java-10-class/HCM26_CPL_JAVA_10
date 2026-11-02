package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teaching-assignments")
@RequiredArgsConstructor
public class AssignmentCreationController {
    private final AssignmentCreationService creation;

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public ResponseEntity<com.example.starter_project_2025.exception.error.ValidationErrorResponse> invalidBody() {
        return ResponseEntity.badRequest().body(new com.example.starter_project_2025.exception.error.ValidationErrorResponse(
                "Provide valid class, program, trainer and subject details, a MAIN or ASSISTANT role and ISO dates.", java.util.Map.of()));
    }

    @PostMapping("/create-with-details")
    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE') and hasAuthority('CLASS_CREATE') and hasAuthority('CLASS_UPDATE_PROGRAM')"
            + " and hasAuthority('PROGRAM_CREATE') and hasAuthority('PROGRAM_UPDATE') and hasAuthority('TRAINER_CREATE')")
    public ResponseEntity<TeachingAssignmentResponse> create(@Valid @RequestBody AssignmentCreationService.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(creation.create(request));
    }
}
