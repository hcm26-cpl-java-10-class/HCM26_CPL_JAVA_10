package com.example.starter_project_2025.system.project.aiassistant.mapper;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewFindingDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportListItem;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewSuggestionCapability;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AIReviewReportMapper {

    private final ObjectMapper objectMapper;

    public AIReviewReportMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

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
                        .map(finding -> toFindingDetail(finding, report))
                        .toList()
        );
    }

    private AIReviewFindingDetail toFindingDetail(AIReviewFinding finding, AIReviewReport report) {
        JsonNode module = finding.getCategory() == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.MODULE
                ? findModule(report.getSnapshot().getContentJson(), finding.getTargetId())
                : null;
        Long targetSnapshotId = finding.getTargetSnapshotId() != null
                ? finding.getTargetSnapshotId()
                : module != null && module.path("versionId").canConvertToLong()
                        ? module.path("versionId").asLong()
                        : null;
        boolean moduleWithoutSnapshot = finding.getCategory()
                == com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingCategory.MODULE
                && targetSnapshotId == null;
        return new AIReviewFindingDetail(
                finding.getId(),
                finding.getCategory().name(),
                finding.getSeverity().name(),
                finding.getStatus().name(),
                finding.getTitle(),
                finding.getDescription(),
                finding.getRecommendation(),
                moduleWithoutSnapshot
                        ? AIReviewSuggestionCapability.MANUAL_REQUIRED.name()
                        : finding.getSuggestionCapability() == null
                        ? AIReviewSuggestionCapability.MANUAL_REQUIRED.name()
                        : finding.getSuggestionCapability().name(),
                moduleWithoutSnapshot
                        ? "This module has no snapshot in the reviewed version. Create a new review after its draft version is included before generating a suggestion."
                        : finding.getSuggestionCapabilityReason() == null
                        || finding.getSuggestionCapabilityReason().isBlank()
                        ? "This finding predates suggestion capability classification. Run a new review before generating a suggestion."
                        : finding.getSuggestionCapabilityReason(),
                finding.getTargetType(),
                finding.getTargetId(),
                targetSnapshotId,
                finding.getTargetCode() != null
                        ? finding.getTargetCode()
                        : module != null ? text(module, "code") : null,
                finding.getTargetName() != null
                        ? finding.getTargetName()
                        : module != null ? text(module, "name") : null
        );
    }

    private JsonNode findModule(String snapshotContent, String targetId) {
        if (targetId == null) return null;
        try {
            JsonNode root = objectMapper.readTree(snapshotContent);
            return findModule(root.path("modules"), targetId);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to read modules from the review snapshot", exception);
        }
    }

    private JsonNode findModule(JsonNode modules, String targetId) {
        if (!modules.isArray()) return null;
        for (JsonNode module : modules) {
            if (targetId.equals(module.path("templateId").asText())) return module;
            JsonNode nested = findModule(module.path("modules"), targetId);
            if (nested != null) return nested;
        }
        return null;
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }
}