package com.example.starter_project_2025.system.git_integration.service;

import com.example.starter_project_2025.system.git_integration.domain.GitArtifact;
import com.example.starter_project_2025.system.git_integration.domain.GitArtifactType;
import com.example.starter_project_2025.system.git_integration.domain.GitCommit;
import com.example.starter_project_2025.system.git_integration.domain.GitPullRequest;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** Converts IDs from requests/events into managed relationships at the application boundary. */
@Component
@RequiredArgsConstructor
public class GitEntityReferences {
    private final EntityManager entities;

    public <T> T get(Class<T> type, Long id) {
        return id == null ? null : entities.getReference(type, id);
    }

    public GitArtifact artifact(
            GitArtifactType type, Long id) {
        if (id == null) return null;
        return type == GitArtifactType.COMMIT
                ? get(GitCommit.class, id)
                : get(GitPullRequest.class, id);
    }
}
