package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContextBuilder;

import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.review.AIReviewOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIReviewReport;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ProjectTemplateReviewAccessService reviewAccessService;
    private final ReviewContextBuilder reviewContextBuilder;
    private final ProjectTemplateReviewOrchestrator reviewOrchestrator;
    private final AIReviewResultPersistenceService resultPersistenceService;


    @Transactional(readOnly = true)
    public ReviewContext buildReviewContext(Long templateId, Long snapshotId) {

        ProjectTemplate template =
                reviewAccessService.requireReadableTemplate(templateId);

        return reviewContextBuilder.build(template, snapshotId);
    }

    public AIReviewReport review(Long templateId, Long snapshotId) {
        // 1. Kiểm tra quyền và lấy Template
        ProjectTemplate template =
                reviewAccessService.requireReadableTemplate(templateId);

        // 2. Xây dựng context từ Snapshot
        ReviewContext context =
                reviewContextBuilder.build(template, snapshotId);

        // 3. Gọi AI review toàn bộ Template
        AIReviewOutput output =
                reviewOrchestrator.review(context);

        // 4. Lưu Report và Findings
        return resultPersistenceService.persist(
                output,
                template,
                snapshotId
        );
    }



}