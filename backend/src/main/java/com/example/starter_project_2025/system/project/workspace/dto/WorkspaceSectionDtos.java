package com.example.starter_project_2025.system.project.workspace.dto;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.*;
import java.util.List;
import java.util.Map;

public final class WorkspaceSectionDtos {
    private WorkspaceSectionDtos() { }
    public record Scope(Long tenantId, Long workspaceId, Long projectId, Long teamId) {
        public static Scope from(Workspace workspace) {
            return new Scope(workspace.getTenant().getId(), workspace.getId(),
                    workspace.getProject().getId(), workspace.getTeam().getId());
        }
    }
    public record Access(String key, boolean canRead, Map<String, Boolean> actions) { }
    public record Navigation(Long workspaceId, Long projectId, Long teamId,
                             String projectCode, String projectName, String teamName,
                             ProjectStatus projectStatus, List<Access> sections) { }
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Item(String id, String title, String description, String status, boolean published,
                       Double score, java.time.Instant occurredAt) {
        public Item(String id, String title, String description, String status, boolean published, Double score) {
            this(id, title, description, status, published, score, null);
        }
    }
    public record Content(Long workspaceId, Long projectId, Long teamId, String section, List<Item> items) { }
    public record Create(@NotBlank @Size(max = 120) String title,
                         @Size(max = 2000) String description, boolean published) { }
    public enum ReviewKind { ARTIFACT, MILESTONE, SPRINT }
    public record Review(@NotNull ReviewKind kind, @NotBlank String targetId,
                         @NotBlank @Size(max = 2000) String comment,
                         @DecimalMin("0.0") @DecimalMax("10.0") Double score, boolean published) { }
    public enum MockMode { DATA, EMPTY, NOT_FOUND, ERROR }
    public record MockControl(@NotNull MockMode mode, @Min(0) @Max(5000) long delayMs) { }
}
