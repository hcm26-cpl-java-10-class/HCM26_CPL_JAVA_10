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
public class WorkspaceCandidateFilter {
    private Long cohortId;
    private Long projectId;
    private String projectName;
    private String teamName;
    private WorkspaceStatus workspaceStatus;
    private ProjectStatus projectStatus;
    private Boolean onlyUncreated;
}

