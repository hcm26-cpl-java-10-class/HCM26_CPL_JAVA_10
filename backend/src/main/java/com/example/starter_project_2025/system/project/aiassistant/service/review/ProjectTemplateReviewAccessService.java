package com.example.starter_project_2025.system.project.aiassistant.service.review;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProjectTemplateReviewAccessService {

    private final ProjectTemplateAccessService projectTemplateAccessService;
    private final ProjectTemplateRepository templateRepository;

    public ProjectTemplate requireReadableTemplate(Long templateId) {

        User reviewer = projectTemplateAccessService.requireReviewUser();

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

        ProjectTemplate template = templateRepository
                .findReadableById(templateId, tenantId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Project template is outside your data scope"
                ));

        if (template.getTenantId() != null) {
            projectTemplateAccessService.requireReviewTenantScope(reviewer);
        }

        return template;
    }

    public User requireReviewUser() {
        return projectTemplateAccessService.requireReviewUser();
    }
}