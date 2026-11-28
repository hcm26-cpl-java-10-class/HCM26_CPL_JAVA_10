package com.example.starter_project_2025.system.project.resources;

import com.example.starter_project_2025.exception.error.ErrorResponse;
import com.example.starter_project_2025.system.project.resources.workspace_resources.WorkspaceResourceController;
import com.example.starter_project_2025.system.project.resources.workspace_resources.WorkspaceResourcePublicController;
import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;

@RestControllerAdvice(assignableTypes = {WorkspaceResourceController.class, WorkspaceResourcePublicController.class})
@Order(Ordered.HIGHEST_PRECEDENCE)
public class WorkspaceResourceErrors {
    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErrorResponse> status(ResponseStatusException exception) {
        int status = exception.getStatusCode().value();
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore())
                .body(new ErrorResponse(status, exception.getReason(), LocalDateTime.now(), WorkspaceCorrelation.current()));
    }
}
