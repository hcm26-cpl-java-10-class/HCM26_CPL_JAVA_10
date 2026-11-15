package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.aiassistant.mapper.AIReviewResultMapper;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AIReviewResultPersistenceService {

    private final AIReviewReportRepository reportRepository;
    private final AIReviewFindingRepository findingRepository;
    private final AIReviewResultMapper resultMapper;
    private final TemplateSnapshotRetrievalService snapshotRetrievalService;

    @Transactional
    public AIReviewReport persist(
            AIReviewOutput output,
            ProjectTemplate template,
            Long snapshotId
    ) {
        // 1. Lấy Snapshot gốc của Template
        ProjectTemplateSnapshot snapshot =
                snapshotRetrievalService.retrieve(template.getId(), snapshotId);

        // 2. Mapping AIReviewOutput thành AIReviewReport
        AIReviewReport report =
                resultMapper.toReport(output, template, snapshot);

        // 3. Lưu Report trước để có ID
        report = reportRepository.save(report);

        // 4. Mapping toàn bộ Findings, gắn với Report vừa lưu
        List<AIReviewFinding> findings =
                resultMapper.toFindings(output, report);

        // 5. Lưu toàn bộ Findings
        findingRepository.saveAll(findings);

        return report;
    }
}