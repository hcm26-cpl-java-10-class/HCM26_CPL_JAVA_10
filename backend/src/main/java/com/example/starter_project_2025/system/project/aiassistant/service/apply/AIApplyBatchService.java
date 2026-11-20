package com.example.starter_project_2025.system.project.aiassistant.service.apply;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.aiassistant.entity.AIApplyBatch;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AIApplyBatchRepository;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;

import com.example.starter_project_2025.system.project.template.ProjectTemplateAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import jakarta.persistence.EntityNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AIApplyBatchService {

    private final AIApplyBatchRepository aiApplyBatchRepository;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final ProjectTemplateRepository projectTemplateRepository;
    private final ProjectTemplateAccessService projectTemplateAccessService;

    @Transactional
    public AIApplyBatch createApplyBatch(
            Long suggestionId,
            Long projectTemplateId
    ) {
        // 1. Tìm Suggestion
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found: " + suggestionId
                ));

        // 2. Kiểm tra trạng thái Suggestion
        if (suggestion.getStatus() != SuggestionStatus.APPROVED) {
            throw new IllegalStateException(
                    "Only APPROVED suggestions can be applied"
            );
        }

        // 3. Ngăn Apply trùng
        if (aiApplyBatchRepository.existsBySuggestion_Id(suggestionId)) {
            throw new IllegalStateException(
                    "This AI Suggestion has already been applied"
            );
        }

        // 4. Lấy User hiện tại và Tenant ID
        User user = projectTemplateAccessService.requireUser("UPDATE");

        // 5. Tìm ProjectTemplate thuộc đúng Tenant
        ProjectTemplate projectTemplate = projectTemplateRepository
                .findByIdAndTenantIdAndIsActiveTrue(
                        projectTemplateId,
                        user.getTenantId()
                )
                .orElseThrow(() -> new EntityNotFoundException(
                        "Project Template not found: " + projectTemplateId
                ));

        // 6. Tạo ApplyBatch
        AIApplyBatch applyBatch = AIApplyBatch.builder()
                .suggestion(suggestion)
                .projectTemplate(projectTemplate)
                .build();

        return aiApplyBatchRepository.save(applyBatch);
    }
}
