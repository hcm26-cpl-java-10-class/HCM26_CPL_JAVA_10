package com.example.starter_project_2025.system.project;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

public interface WorkspaceService {

    List<WorkspaceCandidateItem> getCandidateItems(WorkspaceCandidateFilter filter);

    Page<WorkspaceCandidateItem> getCandidatePage(WorkspaceCandidateFilter filter, Pageable pageable);

    WorkspaceCandidateItem confirmWorkspace(WorkspaceCreateRequest request);
    List<WorkspaceProjectSelection.Option> getProjectOptions(Long teamId);

    WorkspaceDetailResponse getWorkspace(Long id);

    WorkspaceResponse createWorkspace(String idempotencyKey, WorkspaceCreateRequest request);
}
