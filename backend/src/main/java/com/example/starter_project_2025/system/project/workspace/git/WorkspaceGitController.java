package com.example.starter_project_2025.system.project.workspace.git;

import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;

@RestController @RequestMapping("/api/workspaces/{workspaceId}/git-config")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
@RequiredArgsConstructor @Slf4j
public class WorkspaceGitController {
    private final WorkspaceGitService service;
    @GetMapping public GitConfigDtos.View get(@PathVariable Long workspaceId) { return service.get(workspaceId); }
    @PutMapping public GitConfigDtos.View save(@PathVariable Long workspaceId, @Valid @RequestBody GitConfigDtos.Save request) {
        return service.save(workspaceId, request);
    }
    @DeleteMapping public GitConfigDtos.View unlink(@PathVariable Long workspaceId, @RequestParam long version) {
        return service.unlink(workspaceId, version);
    }
    private ResponseEntity<GitConfigDtos.Error> error(int status, String message, Map<String, String> fields) {
        return ResponseEntity.status(status).body(new GitConfigDtos.Error(status, message, fields, WorkspaceCorrelation.current()));
    }
    @ExceptionHandler(GitConfigValidationException.class)
    public ResponseEntity<GitConfigDtos.Error> invalid(GitConfigValidationException ex) {
        return error(422, ex.getMessage(), Map.of(ex.field(), ex.getMessage()));
    }
    @ExceptionHandler(BindException.class)
    public ResponseEntity<GitConfigDtos.Error> invalidFields(BindException ex) {
        Map<String, String> errors = new LinkedHashMap<>();
        ex.getFieldErrors().forEach(e -> errors.putIfAbsent(e.getField(), switch (e.getField()) {
            case "repositoryUrl" -> GitRepositoryValidator.INVALID_URL;
            case "defaultBranch" -> "Enter a branch name of at most 255 characters.";
            default -> "Invalid value. Reload the configuration and try again.";
        }));
        return error(422, "Check the repository configuration.", errors);
    }
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<GitConfigDtos.Error> denied() { return error(403, "You cannot access or change this team's repository.", Map.of()); }
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<GitConfigDtos.Error> status(ResponseStatusException ex) { return error(ex.getStatusCode().value(), ex.getReason(), Map.of()); }
    @ExceptionHandler({HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    public ResponseEntity<GitConfigDtos.Error> malformed() { return error(422, "Invalid repository configuration request.", Map.of()); }
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<GitConfigDtos.Error> failed(RuntimeException ex) {
        // Never log request bodies/URLs or exception messages that may contain credentials.
        log.error("Git config request failed: type={}, correlationId={}", ex.getClass().getSimpleName(), WorkspaceCorrelation.current());
        return error(500, "Could not save or load the repository. Please retry.", Map.of());
    }
}
