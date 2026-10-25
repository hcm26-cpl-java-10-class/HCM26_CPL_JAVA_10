package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceContextService {
    private final WorkspaceRepository workspaces;
    private final WorkspaceAccessService access;

    public Workspace require(User user, Long id) {
        access.requireTenant(user, false);
        Workspace workspace = workspaces.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found"));
        if (!workspace.getTenant().getId().equals(user.getTenant().getId()))
            throw new AccessDeniedException("Workspace is outside the current tenant");
        if (!Boolean.TRUE.equals(workspace.getIsActive()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found");
        access.requirePair(user, workspace.getProject().getId(), workspace.getTeam().getId(), false);
        return workspace;
    }
}
