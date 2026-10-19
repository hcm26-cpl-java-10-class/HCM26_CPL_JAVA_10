package com.example.starter_project_2025.system.schedule.session;

import com.example.starter_project_2025.security.UserPrincipal;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class SessionAccessPolicy {

    public void requireCreateScope() {
        if (!isAdmin()) {
            throw new AccessDeniedException("Class administration scope is not available for this account.");
        }
    }

    public void requireReadScope(Session session) {
        if (isAdmin()) {
            return;
        }
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        if (actor != null && actor.getPrincipal() instanceof UserPrincipal principal
                && principal.getUser().getId().equals(session.getTrainerId())) {
            return;
        }
        throw new AccessDeniedException("Session is outside your assigned scope.");
    }

    private boolean isAdmin() {
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        return actor != null && actor.isAuthenticated() && actor.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
