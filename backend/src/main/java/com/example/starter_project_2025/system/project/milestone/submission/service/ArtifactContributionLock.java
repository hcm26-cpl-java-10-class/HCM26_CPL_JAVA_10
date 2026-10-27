package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import java.util.List;

/** Serializes committed artifact contributions with bulk inactivity checks. */
@Component @RequiredArgsConstructor
public class ArtifactContributionLock {
    private final UserRepository users;
    public void lockCurrentActor() {
        var authentication=SecurityContextHolder.getContext().getAuthentication();
        if(authentication==null || !(authentication.getPrincipal() instanceof UserPrincipal principal))
            throw new AccessDeniedException("The contribution actor is unavailable");
        if(users.lockForContribution(List.of(principal.getUser().getId())).isEmpty())
            throw new AccessDeniedException("The contribution actor is unavailable");
    }
}
