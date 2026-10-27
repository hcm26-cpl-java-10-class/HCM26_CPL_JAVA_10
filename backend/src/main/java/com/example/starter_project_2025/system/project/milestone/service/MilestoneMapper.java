package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneChecklistItem;
import com.example.starter_project_2025.system.project.milestone.dto.response.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Component;

@Component
public class MilestoneMapper {
    public MilestoneResponse toResponse(Milestone milestone) {
        return new MilestoneResponse(
                milestone.getId(), milestone.getProjectId(), milestone.getTeamId(), milestone.getTitle(), milestone.getDescription(),
                milestone.getDeadline(), milestone.isMandatory(), milestone.getStatus(),
                milestone.getRubricSnapshotId(), milestone.getReviewerId(), milestone.getLatePolicyType(),
                milestone.getLateUntil(), milestone.getLatePenaltyPercent(), milestone.getVersion(),
                milestone.getCreatedAt(), milestone.getCreatedBy(),
                milestone.getChecklistItems().stream().map(this::toChecklistResponse).toList()
        );
    }

    public MilestoneListItemResponse toListItem(Milestone milestone) {
        return new MilestoneListItemResponse(
                milestone.getId(), milestone.getTeamId(), milestone.getTitle(), milestone.getDescription(), milestone.getDeadline(),
                milestone.getStatus(), milestone.isMandatory(), milestone.getRubricSnapshotId(),
                milestone.getReviewerId(), milestone.getLatePolicyType(), milestone.getLateUntil(),
                milestone.getLatePenaltyPercent(), milestone.getVersion(), milestone.getCreatedAt()
        );
    }

    public MilestonePageResponse toPageResponse(ProjectReadContext project, Page<Milestone> result) {
        return new MilestonePageResponse(
                project == null ? null : new ProjectMilestoneSummaryResponse(
                        project.projectId(), project.projectName(), project.status()),
                result.getContent().stream().map(this::toListItem).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages(),
                result.hasNext(), result.hasPrevious()
        );
    }

    private ChecklistItemResponse toChecklistResponse(MilestoneChecklistItem item) {
        return new ChecklistItemResponse(
                item.getId(), item.getContent(), item.isMandatory(), item.isCompleted(), item.getOrderIndex()
        );
    }
}
