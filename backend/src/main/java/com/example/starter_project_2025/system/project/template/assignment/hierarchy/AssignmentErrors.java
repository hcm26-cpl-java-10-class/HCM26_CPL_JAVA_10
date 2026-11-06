package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.TeamPublishValidationException;
import com.example.starter_project_2025.system.project.StudentAlreadyAssignedException;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Map;

@RestControllerAdvice(basePackageClasses = ProjectAssignmentController.class)
@Order(Ordered.HIGHEST_PRECEDENCE)
public class AssignmentErrors {
    @ExceptionHandler(com.example.starter_project_2025.system.project.TeamVersionConflictException.class)
    public ResponseEntity<?> teamChanged(RuntimeException exception) {
        return error(409, "PROJECT_ASSIGNMENT_TEAM_CHANGED", "A selected team has changed. Reload the assignment options and review its members and roles");
    }

    @ExceptionHandler(com.example.starter_project_2025.system.project.TeamRoleAssignmentException.class)
    public ResponseEntity<?> memberRoles(RuntimeException exception) {
        return error(422, "PROJECT_ASSIGNMENT_ROLES_INVALID", "Choose valid roles for every active member of each selected team");
    }

    @ExceptionHandler(com.example.starter_project_2025.system.project.TeamRolePolicyException.class)
    public ResponseEntity<?> rolePolicy(com.example.starter_project_2025.system.project.TeamRolePolicyException exception) {
        String details = exception.getViolations().stream().map(value -> value.role() + ": required "
                + value.required() + ", selected " + value.actual()).collect(java.util.stream.Collectors.joining("; "));
        return error(422, exception.getErrorCode(), details.isEmpty()
                ? "The selected roles do not follow the assigned template's role policy" : "Check member role quotas: " + details);
    }
    @ExceptionHandler(com.example.starter_project_2025.system.project.milestone.exception.MilestoneConflictException.class)
    public ResponseEntity<?> milestoneConflict(RuntimeException exception) {
        return error(409, "MASTER_MILESTONE_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException.class)
    public ResponseEntity<?> milestoneValidation(RuntimeException exception) {
        return error(422, "MASTER_MILESTONE_INVALID", "Review the shared milestone submission data");
    }

    @ExceptionHandler(TeamPublishValidationException.class)
    public ResponseEntity<?> publishing(TeamPublishValidationException exception) {
        return error(422, "PROJECT_ASSIGNMENT_TEAM_NOT_READY",
                "A draft team is not ready to publish. Check its active members, roles and assigned mentor");
    }

    @ExceptionHandler(StudentAlreadyAssignedException.class)
    public ResponseEntity<?> memberConflict(StudentAlreadyAssignedException exception) {
        return error(409, "PROJECT_ASSIGNMENT_MEMBER_CONFLICT", "A selected member already belongs to another active team");
    }

    @ExceptionHandler(AssignmentException.class)
    public ResponseEntity<?> business(AssignmentException exception) {
        return error(exception.getStatusCode().value(), exception.getCode(), exception.getReason());
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<?> denied(AccessDeniedException exception) {
        return error(403, "PROJECT_ASSIGNMENT_ACCESS_DENIED", "This operation is outside your project or class scope");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<?> invalid(MethodArgumentNotValidException exception) {
        return error(422, "PROJECT_ASSIGNMENT_INVALID", "Review the selected template, teams and module mappings");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> conflict(DataIntegrityViolationException exception) {
        return error(409, "PROJECT_ASSIGNMENT_CONFLICT", "The assignment data has changed. Reload and try again");
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<?> response(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), "PROJECT_ASSIGNMENT_FAILED", exception.getReason());
    }

    private ResponseEntity<?> error(int status, String code, String message) {
        return ResponseEntity.status(status).body(Map.of("status", status, "code", code,
                "message", message == null ? "The request could not be completed" : message,
                "timestamp", Instant.now(), "correlationId", CorrelationIdFilter.currentId()));
    }
}
