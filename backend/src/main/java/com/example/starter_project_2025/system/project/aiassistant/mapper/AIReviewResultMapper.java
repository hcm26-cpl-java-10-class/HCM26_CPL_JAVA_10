package com.example.starter_project_2025.system.project.aiassistant.mapper;

import com.example.starter_project_2025.system.project.template.domain.ProjectTemplate;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingOutput;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingSeverity;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
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
            AIReviewReport report
    ) {
        return AIReviewFinding.builder()
                .report(report)
                .category(AIReviewFindingCategory.valueOf(output.category()))
                .severity(AIReviewFindingSeverity.valueOf(output.severity()))
                .status(AIReviewFindingStatus.OPEN)
                .title(output.title())
                .description(output.description())
                .recommendation(output.recommendation())
                .targetType(output.targetType())
                .targetId(output.targetId())
                .build();
    }

    public List<AIReviewFinding> toFindings(
            AIReviewOutput output,
            AIReviewReport report
    ) {
        return output.findings().stream()
                .map(finding -> toFinding(finding, report))
                .toList();
    }

}