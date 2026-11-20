package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewFinding;
import com.example.starter_project_2025.system.project.aiassistant.enums.AIReviewFindingStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewFindingRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIReviewReportRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AIReviewFindingManagementService {

    private final AIReviewFindingRepository findingRepository;
    private final AIReviewReportRepository reportRepository;
    private final ProjectTemplateReviewAccessService reviewAccessService;

    private AIReviewFinding getFindingForManagement(
            Long templateId,
            Long reportId,
            Long findingId
    ) {
        // 1. Kiểm tra người dùng có quyền truy cập Template
        reviewAccessService.requireReadableTemplate(templateId);

        // 2. Kiểm tra Report có thuộc Template không
        reportRepository.findByIdAndProjectTemplate_Id(reportId, templateId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Review report not found"
                ));

        // 3. Kiểm tra Finding có thuộc Report không
        return findingRepository.findByIdAndReport_Id(findingId, reportId)
                .orElseThrow(() -> new IllegalArgumentException(
                        "Review finding not found"
                ));
    }

    @Transactional
    public void accept(
            Long templateId,
            Long reportId,
            Long findingId
    ) {
        AIReviewFinding finding = getFindingForManagement(
                templateId,
                reportId,
                findingId
        );

        if (finding.getStatus() != AIReviewFindingStatus.OPEN) {
            throw new IllegalStateException(
                    "Only OPEN findings can be accepted"
            );
        }

        User reviewer = reviewAccessService.requireReviewUser();

        finding.setStatus(AIReviewFindingStatus.ACCEPTED);
        finding.setAcceptedAt(LocalDateTime.now());
        finding.setAcceptedBy(reviewer.getId());
    }

    @Transactional
    public void dismiss(
            Long templateId,
            Long reportId,
            Long findingId,
            String reason
    ) {
        AIReviewFinding finding = getFindingForManagement(
                templateId,
                reportId,
                findingId
        );

        if (finding.getStatus() != AIReviewFindingStatus.OPEN) {
            throw new IllegalStateException(
                    "Only OPEN findings can be dismissed"
            );
        }

        User reviewer = reviewAccessService.requireReviewUser();

        finding.setStatus(AIReviewFindingStatus.DISMISSED);
        finding.setDismissedAt(LocalDateTime.now());
        finding.setDismissedBy(reviewer.getId());
        finding.setDismissReason(reason);
    }

    @Transactional
    public void resolve(
            Long templateId,
            Long reportId,
            Long findingId
    ) {
        AIReviewFinding finding = getFindingForManagement(
                templateId,
                reportId,
                findingId
        );

        if (finding.getStatus() != AIReviewFindingStatus.ACCEPTED) {
            throw new IllegalStateException(
                    "Only ACCEPTED findings can be resolved"
            );
        }

        finding.setStatus(AIReviewFindingStatus.RESOLVED);
        finding.setResolvedAt(LocalDateTime.now());
    }



}