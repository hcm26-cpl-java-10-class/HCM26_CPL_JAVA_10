package com.example.starter_project_2025.system.project.workspace.git;

import jakarta.validation.constraints.*;
import java.time.Instant;
import java.util.Map;

public final class GitConfigDtos {
    private GitConfigDtos() { }
    public record Save(@NotNull @Min(0) Long version,
                       @NotBlank @Size(max = 2048) String repositoryUrl,
                       @NotBlank @Size(max = 255) String defaultBranch,
                       @Size(max = 2048) String repositoryWebUrl) {
        // Spring may log DTO.toString() at DEBUG before validation runs.
        @Override public String toString() { return "GitConfigSave[version=" + version + ", fields=REDACTED]"; }
    }
    public record View(Long workspaceId, boolean configured, String repositoryUrl,
                       String repositoryWebUrl, String provider, String defaultBranch,
                       long version, Instant updatedAt, String updatedBy,
                       boolean canEdit, boolean canUnlink) {
        @Override public String toString() { return "GitConfigView[workspaceId=" + workspaceId + ", configured=" + configured + ", version=" + version + "]"; }
    }
    public record Error(int status, String message, Map<String, String> errors, String correlationId) { }
}
