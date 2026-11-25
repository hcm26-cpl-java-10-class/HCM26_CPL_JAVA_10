package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import javax.sql.DataSource;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@RestController @RequiredArgsConstructor
@ConditionalOnProperty(name = "app.workspace.sections.mock-controls.enabled", havingValue = "true")
@RequestMapping("/api/workspaces/{id}/mock-sections")
@PreAuthorize("hasRole('ADMIN')")
public class WorkspaceMockSectionsController {
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceSectionPolicy policy;
    private final MockWorkspaceSectionDataSource mock;
    private final DataSource dataSource;

    @PutMapping("/{key}")
    public MockControl configure(@PathVariable Long id, @PathVariable String key, @Valid @RequestBody MockControl request) throws Exception {
        try (var connection = dataSource.getConnection()) {
            if (!connection.getMetaData().getURL().startsWith("jdbc:h2:"))
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Mock controls are disabled");
        }
        var user = access.requireUser(false);
        mock.configure(Scope.from(contexts.require(user, id)), policy.section(key), request);
        return request;
    }
}
