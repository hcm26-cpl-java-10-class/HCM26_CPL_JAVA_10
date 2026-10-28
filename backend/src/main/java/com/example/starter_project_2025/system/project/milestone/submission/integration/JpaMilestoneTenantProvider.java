package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.milestone.integration.port.MilestoneTenantProvider;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Primary;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component @Primary @Profile("!test | artifact-real-scope") @RequiredArgsConstructor
public class JpaMilestoneTenantProvider implements MilestoneTenantProvider {
    private final WorkspaceAccessService access;
    @Override public Long requireCurrentTenantId() {
        return access.requireTenant(access.requireUser(false),false).getId();
    }
}
