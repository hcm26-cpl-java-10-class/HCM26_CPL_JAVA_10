package com.example.starter_project_2025.system.project.aiassistant.service.generation;


import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AiSuggestionService {

    private final TemplateGenerationService templateGenerationService;
    private final AiSuggestionRepository aiSuggestionRepository;

    public AiSuggestionService(
            TemplateGenerationService templateGenerationService,
            AiSuggestionRepository aiSuggestionRepository
    ) {
        this.templateGenerationService = templateGenerationService;
        this.aiSuggestionRepository = aiSuggestionRepository;
    }

    @Transactional
    public GeneratedSuggestionResult generateAndSave(GenerateTemplateRequest request) {

        // 1. Generate AI content
        TemplateGenerationResult result =
                templateGenerationService.generate(request);

        // 2. Build AiSuggestion entity
        AiSuggestion suggestion = AiSuggestion.builder()
                .projectTitle(request.projectTitle())
                .projectDescription(request.projectDescription())
                .projectType(request.projectType())
                .additionalRequirements(request.additionalRequirements())
                .generatedContent(result.generatedContent())
                .aiModel(result.model())
                .status(SuggestionStatus.PENDING)
                .build();

        // 3. Save to database
        AiSuggestion savedSuggestion =
                aiSuggestionRepository.save(suggestion);

        // 4. Return both saved entity and parsed AI output
        return new GeneratedSuggestionResult(
                savedSuggestion,
                result.output()
        );
    }
}