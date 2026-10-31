package com.example.starter_project_2025.system.project.alert;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/workspaces/{workspaceId}/alerts")
public class WorkspaceProjectAlertController {
    private final WorkspaceProjectAlertService service;

    @GetMapping
    public WorkspaceProjectAlertDtos.Page sent(@PathVariable Long workspaceId,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) ProjectAlertDtos.Kind kind) {
        return service.sent(workspaceId, page, size, kind);
    }
}
