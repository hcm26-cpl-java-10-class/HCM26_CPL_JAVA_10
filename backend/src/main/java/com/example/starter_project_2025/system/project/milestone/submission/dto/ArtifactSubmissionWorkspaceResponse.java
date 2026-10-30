package com.example.starter_project_2025.system.project.milestone.submission.dto;

import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneDetailResponse;

public record ArtifactSubmissionWorkspaceResponse(
        MilestoneDetailResponse milestone,
        ArtifactDraftResponse draft,
        ArtifactUploadPolicyResponse uploadPolicy,
        ArtifactSubmissionResponse latestSubmission,
        boolean canSubmit
) { }
