package com.example.starter_project_2025.system.project.aiassistant.mapper;

import com.example.starter_project_2025.system.project.template.domain.ProjectTemplate;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewTemplateNode;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewSuggestionCapability;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewReportStatus;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AIReviewResultMapper {

    public AIReviewReport toReport(
            AIReviewOutput output,
            ProjectTemplate template,
            ProjectTemplateSnapshot snapshot
    ) {
        return AIReviewReport.builder()
                .projectTemplate(template)
                .snapshot(snapshot)
                .status(AIReviewReportStatus.COMPLETED)
                .summary(output.summary())
                .build();
    }

    public AIReviewFinding toFinding(
            AIReviewFindingOutput output,
            AIReviewReport report,
            ReviewContext context
    ) {
        ReviewTemplateNode module = output.category().equals("MODULE")
                ? findModule(context.modules(), output.targetId())
                : null;
        boolean moduleHasSnapshot = module != null && module.snapshotId() != null;
        return AIReviewFinding.builder()
                .report(report)
                .category(AIReviewFindingCategory.valueOf(output.category()))
                .severity(AIReviewFindingSeverity.valueOf(output.severity()))
                .status(AIReviewFindingStatus.OPEN)
                .title(output.title())
                .description(output.description())
                .recommendation(output.recommendation())
                .suggestionCapability(module != null && !moduleHasSnapshot
                        ? AIReviewSuggestionCapability.MANUAL_REQUIRED
                        : AIReviewSuggestionCapability.valueOf(output.suggestionCapability()))
                .suggestionCapabilityReason(module != null && !moduleHasSnapshot
                        ? "This module has no reviewable snapshot. Create or publish a module version before generating a suggestion."
                        : output.suggestionCapabilityReason())
                .targetType(output.targetType())
                .targetId(output.targetId())
                .targetSnapshotId(module == null ? null : module.snapshotId())
                .targetCode(module == null ? null : module.code())
                .targetName(module == null ? null : module.name())
                .build();
    }

    public List<AIReviewFinding> toFindings(
            AIReviewOutput output,
            AIReviewReport report,
            ReviewContext context
    ) {
        return output.findings().stream()
                .map(finding -> toFinding(finding, report, context))
                .toList();
    }

    private ReviewTemplateNode findModule(List<ReviewTemplateNode> modules, String targetId) {
        if (modules == null || targetId == null) return null;
        for (ReviewTemplateNode module : modules) {
            if (targetId.equals(String.valueOf(module.templateId()))) return module;
            ReviewTemplateNode nested = findModule(module.modules(), targetId);
            if (nested != null) return nested;
        }
        return null;
    }

}