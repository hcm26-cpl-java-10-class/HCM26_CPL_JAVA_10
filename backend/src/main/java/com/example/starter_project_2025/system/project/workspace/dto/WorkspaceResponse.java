package com.example.starter_project_2025.system.project.workspace.dto;

import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkspaceResponse {
    private Long id;
    private Long projectId;
    private Long teamId;
    private Long tenantId;
    private String code;
    private String name;
    private WorkspaceStatus status;
    private Long createdBy;
    private LocalDateTime createdAt;
    private List<String> sections;
}

