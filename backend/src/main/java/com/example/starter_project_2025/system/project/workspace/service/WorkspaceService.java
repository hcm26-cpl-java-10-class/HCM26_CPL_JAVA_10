package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCandidateFilter;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCandidateItem;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceCreateRequest;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceDetailResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WorkspaceService {

    List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter);

    Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable);

    WorkspaceCandidateItem confirmWorkspace(WorkspaceCreateRequest request);
    List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId);

    WorkspaceDetailResponse getWorkspace(Long id);
    List<WorkspaceMemberResponse> getMembers(Long id);

    WorkspaceResponse createWorkspace(String idempotencyKey, WorkspaceCreateRequest request);
}
