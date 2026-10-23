package com.example.starter_project_2025.system.project;

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

