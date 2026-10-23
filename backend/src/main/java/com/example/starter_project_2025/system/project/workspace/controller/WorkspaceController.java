package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/workspaces")
@RequiredArgsConstructor
public class WorkspaceController {
    private final WorkspaceService workspaceService;
    private static final String READ = "hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')";
    private static final String CREATE = "hasAnyAuthority('WORKSPACE_CREATE', 'CREATE_PROJECT_WORKSPACE')";

    @GetMapping("/projects")
    @PreAuthorize(CREATE)
    public List<WorkspaceProjectSelection.Option> projects(@RequestParam Long teamId) {
        return workspaceService.getProjectOptions(teamId);
    }

    @GetMapping("/candidates")
    @PreAuthorize(READ)
    public List<WorkspaceCandidateItem> getCandidates(WorkspaceCandidateFilter filter) {
        return workspaceService.getCandidateItems(filter);
    }

    @GetMapping("/candidates/page")
    @PreAuthorize(READ)
    public Page<WorkspaceCandidateItem> getCandidatesPage(WorkspaceCandidateFilter filter, Pageable pageable,
            @RequestParam(defaultValue = "20") String size, @RequestParam(defaultValue = "0") String page) {
        // Validate raw values before Pageable's fallback/clamping hides invalid input.
        int pageSize = number(size, "size", 1, 100);
        int pageIndex = number(page, "page", 0, Integer.MAX_VALUE);
        return workspaceService.getCandidatePage(filter, PageRequest.of(pageIndex, pageSize, pageable.getSort()));
    }

    private int number(String value, String field, int min, int max) {
        try {
            int parsed = Integer.parseInt(value);
            if (parsed >= min && parsed <= max) return parsed;
        } catch (NumberFormatException ignored) { }
        throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, field + " phải trong khoảng " + min + "–" + max);
    }

    @PostMapping("/confirm")
    @PreAuthorize(CREATE)
    public WorkspaceCandidateItem confirmWorkspace(@Valid @RequestBody WorkspaceCreateRequest request) {
        return workspaceService.confirmWorkspace(request);
    }

    @GetMapping("/{id}")
    @PreAuthorize(READ)
    public WorkspaceDetailResponse getWorkspace(@PathVariable Long id) { return workspaceService.getWorkspace(id); }

    @PostMapping
    @PreAuthorize(CREATE)
    public ResponseEntity<WorkspaceResponse> createWorkspace(
            @RequestHeader(value = "X-Idempotency-Key", required = false) String key,
            @Valid @RequestBody WorkspaceCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(workspaceService.createWorkspace(key, request));
    }

    public record WorkspaceError(int status, String message, LocalDateTime timestamp, Long workspaceId, String correlationId) { }
    private ResponseEntity<WorkspaceError> error(int status, String message, Long workspaceId) {
        return ResponseEntity.status(status).body(new WorkspaceError(status, message, LocalDateTime.now(), workspaceId, WorkspaceCorrelation.current()));
    }

    @ExceptionHandler(WorkspaceConflictException.class)
    public ResponseEntity<WorkspaceError> conflict(WorkspaceConflictException exception) {
        return error(409, exception.getMessage(), exception.getWorkspaceId());
    }

    @ExceptionHandler(WorkspaceRelationshipException.class)
    public ResponseEntity<WorkspaceError> invalidRelationship(WorkspaceRelationshipException exception) {
        return error(422, exception.getMessage(), null);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<WorkspaceError> status(ResponseStatusException exception) {
        return error(exception.getStatusCode().value(), exception.getReason(), null);
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<WorkspaceError> validation(BindException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .map(field -> field.getField() + ": " + field.getDefaultMessage()).findFirst().orElse("Tham số không hợp lệ");
        return error(422, message, null);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<WorkspaceError> denied(AccessDeniedException exception) {
        return error(403, "Bạn không còn quyền truy cập project/team này", null);
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<WorkspaceError> failed(RuntimeException exception) {
        log.error("Workspace request failed; correlationId={}", WorkspaceCorrelation.current(), exception);
        return error(500, "Không thể hoàn tất thao tác workspace. Vui lòng thử lại.", null);
    }
}
