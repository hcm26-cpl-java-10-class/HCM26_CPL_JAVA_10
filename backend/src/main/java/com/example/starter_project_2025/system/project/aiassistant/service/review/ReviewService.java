package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContext;
import com.example.starter_project_2025.system.project.aiassistant.dto.ReviewContextBuilder;

import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReviewService {

    private final ProjectTemplateAccessService projectTemplateAccessService;
    private final ProjectTemplateRepository templateRepository;
    private final ReviewContextBuilder reviewContextBuilder;

    @Transactional(readOnly = true)
    public ReviewContext buildReviewContext(Long templateId, Long snapshotId) {

        User reviewer = projectTemplateAccessService.requireReviewUser();

        ProjectTemplate template = resolveReadableTemplate(reviewer, templateId);

        return reviewContextBuilder.build(template, snapshotId);
    }

    private ProjectTemplate resolveReadableTemplate(User reviewer, Long templateId) {

        boolean admin = reviewer.getRoles().stream()
                .anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                        && "ADMIN".equals(role.getName()));

        if (admin) {
            return templateRepository.findReadableByIdForAdmin(templateId)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Project template not found or not readable"
                    ));
        }

        Long tenantId = reviewer.getTenantId();

        // Mentor có thể truy cập Template thuộc Tenant của mình
        // hoặc Global Template.
        ProjectTemplate template = templateRepository
                .findReadableById(templateId, tenantId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Project template is outside your data scope"
                ));

        // Chỉ yêu cầu Tenant scope khi Template thuộc một Tenant.
        if (template.getTenantId() != null) {
            projectTemplateAccessService.requireReviewTenantScope(reviewer);
        }

        return template;
    }
}