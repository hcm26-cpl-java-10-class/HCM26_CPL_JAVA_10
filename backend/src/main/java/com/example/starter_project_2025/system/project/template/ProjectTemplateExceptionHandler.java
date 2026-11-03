package com.example.starter_project_2025.system.project.template;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.exception.error.ValidationErrorResponse;
import com.fasterxml.jackson.databind.JsonMappingException;
import jakarta.persistence.OptimisticLockException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@Slf4j
@RestControllerAdvice(assignableTypes = {ProjectTemplateController.class,
        com.example.starter_project_2025.system.project.template.version.TemplateVersionConfigurationController.class,
        com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotController.class,
        com.example.starter_project_2025.system.project.resources.template_resources.TemplateResourceVersionController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class ProjectTemplateExceptionHandler {
    @ExceptionHandler(ProjectTemplateException.class)
    public ResponseEntity<ValidationErrorResponse> business(ProjectTemplateException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(new ValidationErrorResponse(exception.getMessage(), exception.getErrors()));
    }

    @ExceptionHandler({OptimisticLockException.class, OptimisticLockingFailureException.class})
    public ResponseEntity<ErrorResponse> stale(Exception exception) {
        return error(409, "This template has changed. Reload it before saving your changes");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<?> integrity(DataIntegrityViolationException exception) {
        String cause = exception.getMostSpecificCause().getMessage();
        if (cause != null && cause.toLowerCase(java.util.Locale.ROOT).contains("uk_template_tenant_code_version")) {
            return business(ProjectTemplateException.duplicateCode());
        }
        return error(409, "The template could not be saved because its data has changed. Please reload and try again");
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ValidationErrorResponse> invalidBody(HttpMessageNotReadableException exception) {
        String field = "request";
        if (exception.getCause() instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()
                && mapping.getPath().getFirst().getFieldName() != null) {
            StringBuilder path = new StringBuilder();
            for (var reference : mapping.getPath()) {
                if (reference.getFieldName() != null) {
                    if (!path.isEmpty()) path.append('.');
                    path.append(reference.getFieldName());
                } else if (reference.getIndex() >= 0) {
                    path.append('[').append(reference.getIndex()).append(']');
                }
            }
            field = path.toString();
        }
        String leaf = field.substring(field.lastIndexOf('.') + 1);
        String message = switch (leaf) {
            case "estimatedDurationWeeks" -> "Estimated duration must be a positive whole number of weeks";
            case "level" -> "Select Beginner, Intermediate or Advanced";
            case "lockVersion" -> "A valid template revision is required. Please reload the template";
            case "minMembers", "maxMembers" -> "Team size must be a positive whole number";
            case "pm", "ba", "dev", "qa" ->
                    "Role minimum must be a whole number of 0 or greater";
            case "roleQuotas" -> "Enter the minimum number for PM, BA, DEV and QA";
            case "allowMultiRole" -> "Choose whether members can hold multiple roles";
            case "dueAfter" -> "Due after must be a positive whole number";
            case "dueUnit" -> "Select days or weeks";
            case "rubricVersionId" -> "Select a valid published rubric version";
            case "mandatory" -> "Choose whether this item is required";
            case "suggestedRole" -> "Select PM, BA, DEV or QA";
            case "type" -> "Select File or URL";
            case "milestoneId" -> "Select a valid saved milestone from this template";
            case "allowedMimeTypes" -> "Select supported file formats";
            case "weight" -> "Weight must be between 0 and 100 with up to 2 decimal places";
            case "maxScore" -> "Maximum score must be between 0.01 and 99999999.99 (up to 2 decimal places)";
            case "allowLateSubmission" -> "Choose whether late submissions are allowed";
            case "maxLateDays" -> "Maximum late days must be a positive whole number";
            case "penaltyPerDayPercent" -> "Daily penalty must be between 0 and 100 with up to 2 decimal places";
            case "latePolicy" -> "Provide a valid late submission policy";
            case "id" -> "Provide a valid saved item ID";
            default -> "Invalid request data";
        };
        return business(new ProjectTemplateException(422, message, Map.of(field, List.of(message))));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> invalidParameter(MethodArgumentTypeMismatchException exception) {
        return error(422, "Invalid " + exception.getName());
    }

    @ExceptionHandler({org.springframework.web.multipart.support.MissingServletRequestPartException.class,
            org.springframework.web.multipart.MaxUploadSizeExceededException.class})
    public ResponseEntity<ValidationErrorResponse> invalidUpload(Exception exception) {
        String message = "Choose a file within the upload size limit";
        return business(new ProjectTemplateException(422, message, Map.of("file", List.of(message))));
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> status(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), exception.getReason());
    }

    @ExceptionHandler(com.example.starter_project_2025.exception.ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> notFound(com.example.starter_project_2025.exception.ResourceNotFoundException exception) {
        return error(404, exception.getMessage());
    }

    @ExceptionHandler(AuthenticationCredentialsNotFoundException.class)
    public ResponseEntity<ErrorResponse> unauthenticated(AuthenticationCredentialsNotFoundException exception) {
        return error(401, "Please sign in");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> forbidden(AccessDeniedException exception) {
        return error(403, "You do not have permission to access project templates in this scope");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> unexpected(Exception exception) {
        log.error("Project template request failed", exception);
        return error(500, "Unable to process the project template request");
    }

    private ResponseEntity<ErrorResponse> error(int status, String message) {
        return ResponseEntity.status(status).body(new ErrorResponse(status, message, LocalDateTime.now()));
    }
}
