package com.example.starter_project_2025.system.project.workspace.dto;

import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceCandidateItem {
    private Long projectId;
    private String projectName;
    private String projectCode;
    private ProjectStatus projectStatus;

    private Long teamId;
    private String teamName;
    private String teamCode;
    private Long memberCount;

    private Long cohortId;
    private String cohortName;

    private Long workspaceId;
    private WorkspaceStatus workspaceStatus;
    private Boolean eligibleForWorkspace;
    private String ineligibleReason;
}

