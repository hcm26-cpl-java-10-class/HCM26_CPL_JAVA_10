package com.example.starter_project_2025.system.project.controller;

import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.service.ProjectHubService;
import com.example.starter_project_2025.system.project.team.TeamMembershipService;
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
    private final TeamMembershipService membership;

    @GetMapping("/teams/{id}/members")
    @PreAuthorize("hasAuthority('TEAM_UPDATE') and hasAuthority('WORKSPACE_MEMBER_READ') and hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public List<ProjectHubDtos.ManagedMember> members(@PathVariable Long id) { return membership.members(id); }

    @GetMapping("/teams/{id}/member-options")
    @PreAuthorize("hasAuthority('TEAM_UPDATE') and hasAuthority('WORKSPACE_MEMBER_READ') and hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public List<ProjectHubDtos.MemberOption> memberOptions(@PathVariable Long id) { return membership.options(id); }

    @PutMapping("/teams/{id}/members/{userId}")
    @PreAuthorize("hasAuthority('TEAM_UPDATE') and hasAuthority('WORKSPACE_MEMBER_READ') and hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
    public ProjectHubDtos.ManagedMember updateMember(@PathVariable Long id, @PathVariable Long userId,
            @Valid @RequestBody ProjectHubDtos.MembershipUpdate request) {
        return membership.save(id, userId, request);
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
    @PreAuthorize("hasAuthority('TEAM_UPDATE')")
    public ProjectHubDtos.TeamView saveCharter(@PathVariable Long id, @Valid @RequestBody ProjectHubDtos.Charter request) {
        return service.saveCharter(id, request);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> statusError(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(new ErrorResponse(
                exception.getStatusCode().value(), exception.getReason(), LocalDateTime.now()));
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
