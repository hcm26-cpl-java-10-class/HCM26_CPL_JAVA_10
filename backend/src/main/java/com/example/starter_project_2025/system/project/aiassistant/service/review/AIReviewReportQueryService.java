package com.example.starter_project_2025.system.project.aiassistant.service.review;


import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportDetail;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewReportListItem;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.mapper.AIReviewReportMapper;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class AIReviewReportQueryService {

    private final AIReviewReportRepository reportRepository;
    private final AIReviewFindingRepository findingRepository;
    private final AIReviewReportMapper reportMapper;
    private final ProjectTemplateReviewAccessService reviewAccessService;

    public List<AIReviewReportListItem> getReports(Long templateId) {

        reviewAccessService.requireReadableTemplate(templateId);

        return reportRepository
                .findAllByProjectTemplate_IdOrderByCreatedAtDesc(templateId)
                .stream()
                .map(reportMapper::toListItem)
                .toList();
    }

    public AIReviewReportDetail getReportDetail(
            Long templateId,
            Long reportId
    ) {

        reviewAccessService.requireReadableTemplate(templateId);

        AIReviewReport report = reportRepository
                .findByIdAndProjectTemplate_Id(reportId, templateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Review report not found"
                ));

        List<AIReviewFinding> findings =
                findingRepository.findAllByReport_IdOrderByCreatedAtAsc(reportId);

        return reportMapper.toDetail(report, findings);
    }
}