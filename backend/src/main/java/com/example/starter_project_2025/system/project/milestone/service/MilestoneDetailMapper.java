package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneChecklistItem;
import com.example.starter_project_2025.system.project.milestone.dto.response.*;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ReviewerData;
import com.example.starter_project_2025.system.project.milestone.integration.model.RubricSnapshotData;
import org.springframework.stereotype.Component;

import java.time.ZoneId;
import java.util.Comparator;

@Component
public class MilestoneDetailMapper {

    public MilestoneDetailResponse toResponse(
            Milestone milestone,
            ProjectReadContext project,
            RubricSnapshotData rubric,
            ReviewerData reviewer,
            ZoneId tenantTimeZone
    ) {
        return new MilestoneDetailResponse(
                milestone.getId(),
                project == null ? null : new MilestoneDetailProjectResponse(project.projectId(), project.projectName(), project.status()),
                milestone.getTitle(),
                milestone.getDescription(),
                milestone.getDeadline(),
                tenantTimeZone.getId(),
                milestone.isMandatory(),
                milestone.getStatus(),
                milestone.getChecklistItems().stream()
                        .sorted(Comparator.comparingInt(MilestoneChecklistItem::getOrderIndex))
                        .map(this::toChecklistResponse)
                        .toList(),
                new MilestoneRubricDetailResponse(
                        rubric.id(),
                        rubric.name(),
                        rubric.version(),
                        rubric.criteria().stream()
                                .map(criterion -> new MilestoneRubricCriterionResponse(
                                        criterion.code(), criterion.name(), criterion.weight(), criterion.maxScore(),
                                        criterion.ratings().stream().map(rating -> new RubricRatingOptionResponse(
                                                rating.level(), rating.percentage(), rating.description(), rating.orderIndex())).toList()))
                                .toList()
                ),
                reviewer == null ? null : new MilestoneReviewerResponse(reviewer.id(), reviewer.displayName()),
                new MilestoneLatePolicyResponse(
                        milestone.getLatePolicyType(), milestone.getLateUntil(), milestone.getLatePenaltyPercent()),
                new MilestoneResubmissionPolicyResponse(
                        milestone.isAllowResubmission(), milestone.getMaxSubmissionAttempts()),
                milestone.getVersion(),
                milestone.getCreatedAt(),
                milestone.getCreatedBy()
        );
    }

    private ChecklistItemResponse toChecklistResponse(MilestoneChecklistItem item) {
        return new ChecklistItemResponse(
                item.getId(), item.getContent(), item.isMandatory(), item.isCompleted(), item.getOrderIndex()
        );
    }
}
