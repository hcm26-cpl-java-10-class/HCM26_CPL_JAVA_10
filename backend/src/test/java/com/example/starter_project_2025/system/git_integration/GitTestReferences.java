package com.example.starter_project_2025.system.git_integration;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import com.example.starter_project_2025.system.git_integration.domain.*;

/** Detached relationship objects for unit fixtures; integration fixtures persist the referenced rows first. */
public final class GitTestReferences {
    private GitTestReferences() { }
    public static <T extends BaseEntity> T ref(Class<T> type, Long id) {
        if (id == null) return null;
        try {
            T value = type.getDeclaredConstructor().newInstance();
            value.setId(id);
            for (var field : type.getDeclaredFields()) if (field.isAnnotationPresent(jakarta.persistence.Version.class)) {
                field.setAccessible(true);
                field.set(value, 0L);
            }
            return value;
        } catch (ReflectiveOperationException failure) { throw new IllegalArgumentException(type.getName(), failure); }
    }
    public static GitArtifact artifact(GitArtifactType type, Long id) {
        return type == GitArtifactType.COMMIT ? ref(GitCommit.class, id) : ref(GitPullRequest.class, id);
    }
}
