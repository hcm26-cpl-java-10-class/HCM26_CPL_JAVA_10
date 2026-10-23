package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneChecklistItem;
import com.example.starter_project_2025.system.project.milestone.dto.response.ChecklistItemResponse;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneResponse;
import org.springframework.stereotype.Component;

@Component
public class MilestoneMapper {
    public MilestoneResponse toResponse(Milestone milestone) {
        return new MilestoneResponse(
                milestone.getId(), milestone.getProjectId(), milestone.getTitle(), milestone.getDescription(),
                milestone.getDeadline(), milestone.isMandatory(), milestone.getStatus(),
                milestone.getRubricSnapshotId(), milestone.getReviewerId(), milestone.getLatePolicyType(),
                milestone.getLateUntil(), milestone.getLatePenaltyPercent(), milestone.getVersion(),
                milestone.getCreatedAt(), milestone.getCreatedBy(),
                milestone.getChecklistItems().stream().map(this::toChecklistResponse).toList()
        );
    }

    private ChecklistItemResponse toChecklistResponse(MilestoneChecklistItem item) {
        return new ChecklistItemResponse(
                item.getId(), item.getContent(), item.isMandatory(), item.isCompleted(), item.getOrderIndex()
        );
    }
}
