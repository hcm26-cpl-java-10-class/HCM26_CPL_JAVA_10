package com.example.starter_project_2025.system.project.workspace.controller;

import com.example.starter_project_2025.system.project.workspace.domain.ProjectLogType;
import com.example.starter_project_2025.system.project.workspace.dto.ProjectLogDtos.*;
import com.example.starter_project_2025.system.project.workspace.service.ProjectLogService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.BindException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.format.annotation.DateTimeFormat;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workspaces/{id}/logs")
@PreAuthorize("hasAnyAuthority('WORKSPACE_READ', 'VIEW_PROJECT_WORKSPACE')")
public class WorkspaceProjectLogController {
    private final ProjectLogService service;

    @GetMapping
    public Page<LogResponse> list(@PathVariable Long id,
                                  @RequestParam(required = false) ProjectLogType type,
                                  @RequestParam(required = false) String search,
                                  @RequestParam(required = false) Long createdBy,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdFrom,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate createdTo,
                                  @RequestParam(required = false) String targetType,
                                  @RequestParam(required = false) String targetId,
                                  @RequestParam(required = false) String linkType,
                                  @RequestParam(required = false) String itemTargetType,
                                  @RequestParam(required = false) String itemTargetId,
                                  @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String category,
                                  @RequestParam(required = false) String severity,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate meetingFrom,
                                  @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate meetingTo,
                                  @RequestParam(required = false) Long attendeeId,
                                  @RequestParam(required = false) Boolean hasActionItems,
                                  @RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Page must be >= 0 and size must be 1..100");
        return service.list(id, type, search, createdBy, createdFrom, createdTo, targetType, targetId, linkType,
                itemTargetType, itemTargetId, status, category, severity, meetingFrom, meetingTo, attendeeId,
                hasActionItems, page, size);
    }

    @GetMapping("/options")
    public Options options(@PathVariable Long id) {
        return service.options(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LogResponse create(@PathVariable Long id, @Valid @RequestBody CreateRequest request,
                              HttpServletRequest servletRequest) {
        return service.create(id, request, WorkspaceCorrelation.current(), servletRequest.getRemoteAddr());
    }

    @PatchMapping("/{logId}/risk")
    public LogResponse updateRisk(@PathVariable Long id, @PathVariable Long logId,
                                  @Valid @RequestBody RiskUpdateRequest request,
                                  @RequestHeader(value = "If-Match", required = false) Long version,
                                  @RequestHeader(value = "Idempotency-Key", required = false) String key,
                                  HttpServletRequest servletRequest) {
        return service.updateRisk(id, logId, request, version, key, WorkspaceCorrelation.current(),
                servletRequest.getRemoteAddr());
    }

    @GetMapping("/{logId}/history")
    public List<AuditResponse> history(@PathVariable Long id, @PathVariable Long logId) {
        return service.history(id, logId);
    }

    @GetMapping("/{logId}/status-history")
    public List<StatusHistoryResponse> statusHistory(@PathVariable Long id, @PathVariable Long logId) {
        return service.statusHistory(id, logId);
    }

    @ExceptionHandler(BindException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public String validation(BindException exception) {
        return exception.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage()).findFirst().orElse("Invalid project log request");
    }
}
