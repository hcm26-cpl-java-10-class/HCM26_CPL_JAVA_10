package com.example.starter_project_2025.system.project.controller;

import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.service.ProjectHubService;
import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.security.access.AccessDeniedException;
import lombok.extern.slf4j.Slf4j;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/project-hub")
@RequiredArgsConstructor
@Slf4j
public class ProjectHubController {
    private final ProjectHubService service;
    private final com.example.starter_project_2025.system.project.charter.TeamCharterService charterService;

    @GetMapping("/teams/{id}/charter")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.CharterView charter(@PathVariable Long id, @RequestParam(required = false) Long workspaceId) {
        return charterService.getInWorkspace(id, workspaceId);
    }

    @GetMapping("/charter-teams")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public List<ProjectHubDtos.CharterView> charterTeams() { return charterService.list(); }

    @PostMapping("/teams/{id}/charter/confirm")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.CharterView confirmCharter(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.ConfirmCharter request) {
        return charterService.confirm(id, request);
    }

    @PostMapping("/teams/{id}/charter/approve")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.CharterView approveCharter(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.ConfirmCharter request) {
        return charterService.approve(id, request);
    }

    @PostMapping("/teams/{id}/charter/publish")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.CharterView publishCharter(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.ConfirmCharter request) {
        return charterService.publish(id, request);
    }

    @GetMapping("/teams/{id}/charter/history")
    @PreAuthorize("hasAnyAuthority('TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public org.springframework.data.domain.Page<ProjectHubDtos.CharterHistory> charterHistory(@PathVariable Long id,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return charterService.history(id, page, size);
    }
    @GetMapping("/teams")
    @PreAuthorize("hasAuthority('TEAM_READ')")
    public List<ProjectHubDtos.TeamView> teams() { return service.getTeams(); }

    @GetMapping("/mentors")
    @PreAuthorize("hasAuthority('TEAM_UPDATE')")
    public List<ProjectHubDtos.Mentor> mentors() { return service.getMentors(); }

    @PutMapping("/teams/{id}/mentor")
    @PreAuthorize("hasAuthority('TEAM_UPDATE')")
    public ProjectHubDtos.TeamView assignMentor(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.MentorAssignment request) {
        return service.assignMentor(id, request);
    }

    @PutMapping("/teams/{id}/charter")
    @PreAuthorize("hasAnyAuthority('TEAM_UPDATE', 'TEAM_READ', 'WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.TeamView saveCharter(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.Charter request) {
        return service.saveCharter(id, request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> statusError(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(new ErrorResponse(
                exception.getStatusCode().value(), exception.getReason(), LocalDateTime.now()));
    }

    @ExceptionHandler({org.springframework.dao.OptimisticLockingFailureException.class,
            jakarta.persistence.OptimisticLockException.class})
    public ResponseEntity<ErrorResponse> conflict(Exception exception) {
        return ResponseEntity.status(409).body(new ErrorResponse(409,
                "The team or charter has changed. Reload and compare before saving.", LocalDateTime.now()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validationError(MethodArgumentNotValidException exception) {
        return ResponseEntity.unprocessableEntity().body(new ErrorResponse(422,
                exception.getBindingResult().getFieldErrors().stream().map(error -> error.getField() + ": " + error.getDefaultMessage())
                        .findFirst().orElse("Dữ liệu không hợp lệ"), LocalDateTime.now()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> denied(AccessDeniedException exception) {
        return ResponseEntity.status(403).body(new ErrorResponse(403, "Bạn không có quyền thực hiện thao tác này", LocalDateTime.now()));
    }

    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class,
            org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> invalidInput(Exception exception) {
        return ResponseEntity.unprocessableEntity().body(new ErrorResponse(422, "Tham số hoặc nội dung gửi lên không hợp lệ", LocalDateTime.now()));
    }

    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ErrorResponse> failure(RuntimeException exception) {
        if (exception instanceof com.example.starter_project_2025.exception.ResourceNotFoundException missing)
            return ResponseEntity.status(404).body(new ErrorResponse(404, missing.getMessage(), LocalDateTime.now()));
        log.error("Project Hub request failed; correlationId={}", WorkspaceCorrelation.current(), exception);
        return ResponseEntity.internalServerError().body(new ErrorResponse(500, "Không thể hoàn tất thao tác. Vui lòng thử lại.", LocalDateTime.now()));
    }
}
