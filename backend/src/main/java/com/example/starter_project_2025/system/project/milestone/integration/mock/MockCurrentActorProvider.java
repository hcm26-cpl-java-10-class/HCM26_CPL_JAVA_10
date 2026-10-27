package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.milestone.integration.port.CurrentActorProvider;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

@Component
@Profile("!milestone-mock")
public class MockCurrentActorProvider implements CurrentActorProvider {
    @Override
    public UUID requireCurrentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new AccessDeniedException("Authentication is required");
        }

        String stableIdentity = authentication.getPrincipal() instanceof UserPrincipal principal
                ? principal.getUsername()
                : authentication.getName();
        return UUID.nameUUIDFromBytes(stableIdentity.getBytes(StandardCharsets.UTF_8));
    }
}
