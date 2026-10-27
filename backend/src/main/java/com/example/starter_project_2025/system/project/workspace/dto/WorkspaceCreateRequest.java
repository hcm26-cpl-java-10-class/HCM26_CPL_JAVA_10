package com.example.starter_project_2025.system.project.workspace.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceCreateRequest {

    private Long projectId;

    @NotNull(message = "Team ID is required")
    @Positive(message = "Team ID must be positive")
    private Long teamId;

}
