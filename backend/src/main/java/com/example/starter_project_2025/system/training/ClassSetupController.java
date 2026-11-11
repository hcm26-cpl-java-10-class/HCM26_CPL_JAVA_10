package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRequest;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/classes/{classId}")
@RequiredArgsConstructor
@Validated
public class ClassSetupController {
    private final ClassSetupService service;
    public record ProgramLinkRequest(@NotNull @Positive Long programId) {}

    @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class)
    public org.springframework.http.ResponseEntity<java.util.Map<String, String>> unreadable() {
        return org.springframework.http.ResponseEntity.badRequest().body(java.util.Map.of("message", "Use valid Class Setup JSON with numeric IDs and dates in YYYY-MM-DD format."));
    }

    @GetMapping("/setup")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('PROGRAM_READ') and hasAuthority('ASSIGNMENT_READ')")
    public ClassSetupService.Setup get(@PathVariable @Positive Long classId) { return service.get(classId); }

    @PutMapping("/program-link")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('CLASS_UPDATE') and hasAuthority('PROGRAM_READ')")
    public ClassSetupService.ProgramLink link(@PathVariable @Positive Long classId, @Valid @RequestBody ProgramLinkRequest input) {
        return service.link(classId, input.programId()).programLink();
    }

    @PostMapping("/teaching-assignments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('PROGRAM_READ') and hasAuthority('ASSIGNMENT_CREATE')")
    public TeachingAssignmentResponse create(@PathVariable @Positive Long classId, @Valid @RequestBody TeachingAssignmentRequest input) {
        return service.saveAssignment(classId, null, input);
    }

    @PutMapping("/teaching-assignments/{assignmentId}")
    @PreAuthorize("hasAuthority('CLASS_READ') and hasAuthority('PROGRAM_READ') and hasAuthority('ASSIGNMENT_UPDATE')")
    public TeachingAssignmentResponse update(@PathVariable @Positive Long classId, @PathVariable @Positive Long assignmentId,
                                             @Valid @RequestBody TeachingAssignmentRequest input) {
        return service.saveAssignment(classId, assignmentId, input);
    }
}
