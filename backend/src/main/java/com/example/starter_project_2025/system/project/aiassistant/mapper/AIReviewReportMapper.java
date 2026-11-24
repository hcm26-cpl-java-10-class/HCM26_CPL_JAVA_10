package com.example.starter_project_2025.system.project.aiassistant.mapper;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportListItem;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AIReviewReportMapper {

    public AIReviewReportListItem toListItem(AIReviewReport report) {
        return new AIReviewReportListItem(
                report.getId(),
                report.getSnapshot().getId(),
                report.getStatus().name(),
                report.getSummary(),
                report.getCreatedAt()
        );
    }

    public AIReviewReportDetail toDetail(
            AIReviewReport report,
            List<AIReviewFinding> findings
    ) {
        return new AIReviewReportDetail(
                report.getId(),
                report.getProjectTemplate().getId(),
                report.getSnapshot().getId(),
                report.getStatus().name(),
                report.getSummary(),
                report.getCreatedAt(),
                findings.stream()
                        .map(this::toFindingDetail)
                        .toList()
        );
    }

    private AIReviewFindingDetail toFindingDetail(AIReviewFinding finding) {
        return new AIReviewFindingDetail(
                finding.getId(),
                finding.getCategory().name(),
                finding.getSeverity().name(),
                finding.getStatus().name(),
                finding.getTitle(),
                finding.getDescription(),
                finding.getRecommendation(),
                finding.getTargetType(),
                finding.getTargetId()
        );
    }
}