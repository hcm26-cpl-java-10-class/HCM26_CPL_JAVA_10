package com.example.starter_project_2025.system.project;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceCandidateRow {
    private Long projectId;
    private String projectName;
    private Long teamId;
    private String teamName;
    private Long cohortId;
    private String cohortName;
    private Long memberCount;
    private ProjectStatus projectStatus;
    private WorkspaceStatus workspaceStatus;
    private boolean hasWorkspace;
    private boolean canCreate;
}
