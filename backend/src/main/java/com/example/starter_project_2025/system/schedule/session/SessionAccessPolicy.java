package com.example.starter_project_2025.system.schedule.session;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
public class SessionAccessPolicy {

    private final ObjectProvider<SessionReadContextProvider> contextProviders;

    public Authentication requireReadPermission() {
        Authentication actor = SecurityContextHolder.getContext().getAuthentication();
        if (actor == null || !actor.isAuthenticated() || actor instanceof AnonymousAuthenticationToken) {
            throw new AuthenticationCredentialsNotFoundException("Authentication is required.");
        }

        boolean allowed = actor.getAuthorities().stream()
                .anyMatch(authority -> "SESSION_READ".equals(authority.getAuthority()));
        if (!allowed) {
            throw new AccessDeniedException("SESSION_READ permission is required.");
        }
        return actor;
    }

    public SessionReadContextProvider.ReadContext requireReadableContext(Session session, Authentication actor) {
        SessionReadContextProvider provider = contextProviders.getIfAvailable();
        if (provider == null) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                    "Session class scope and display data integration is not available yet.");
        }

        return provider.findReadableContext(
                        session.getCalendarVersionId(), session.getTopicId(), session.getTrainerId(), actor)
                .orElseThrow(() -> new AccessDeniedException("Session is outside your permitted data scope."));
    }
}
