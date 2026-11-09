package com.example.starter_project_2025.system.project.workspace.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceCreateRequest {

    public WorkspaceCreateRequest(Long projectId, Long teamId) {
        this.projectId = projectId;
        this.teamId = teamId;
    }

    private Long projectId;

    @NotNull(message = "Team ID is required")
    @Positive(message = "Team ID must be positive")
    private Long teamId;

    @Pattern(regexp = "^(?:|[A-Za-z0-9]{1,8})$", message = "Task key prefix must contain 1 to 8 letters or digits")
    private String taskKeyPrefix;
}
