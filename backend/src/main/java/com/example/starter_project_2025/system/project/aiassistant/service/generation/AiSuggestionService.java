package com.example.starter_project_2025.system.project.aiassistant.service.generation;


import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.RejectSuggestionRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.UpdateSuggestionRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.SuggestionDetailResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.SuggestionListItemResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;
import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.repository.AiSuggestionRepository;
import com.example.starter_project_2025.system.project.aiassistant.validator.TemplateOutputValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class AiSuggestionService {

    private final TemplateGenerationService templateGenerationService;
    private final AiSuggestionRepository aiSuggestionRepository;
    private final TemplateOutputParser templateOutputParser;
    private final TemplateOutputValidator templateOutputValidator;
    private final ObjectMapper objectMapper;

    public AiSuggestionService(
            TemplateGenerationService templateGenerationService,
            AiSuggestionRepository aiSuggestionRepository,
            TemplateOutputParser templateOutputParser,
            TemplateOutputValidator templateOutputValidator,
            ObjectMapper objectMapper
    ) {
        this.templateGenerationService = templateGenerationService;
        this.aiSuggestionRepository = aiSuggestionRepository;
        this.templateOutputParser = templateOutputParser;
        this.templateOutputValidator = templateOutputValidator;
        this.objectMapper = objectMapper;
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

    @Transactional(readOnly = true)
    public SuggestionDetailResponse getSuggestionDetail(Long suggestionId) {

        // 1. Find suggestion by ID
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() ->
                        new EntityNotFoundException(
                                "AI Suggestion not found with ID: " + suggestionId
                        )
                );

        // 2. Parse stored JSON
        GeneratedTemplateOutput output =
                templateOutputParser.parse(suggestion.getGeneratedContent());

        // 3. Build response
        return new SuggestionDetailResponse(
                suggestion.getId(),
                suggestion.getProjectTitle(),
                suggestion.getProjectDescription(),
                suggestion.getProjectType(),
                suggestion.getAdditionalRequirements(),
                suggestion.getStatus().name(),
                output,
                suggestion.getAiModel(),
                suggestion.getCreatedAt(),
                suggestion.getUpdatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<SuggestionListItemResponse> getAllSuggestions() {
        return aiSuggestionRepository.findAll()
                .stream()
                .map(suggestion -> new SuggestionListItemResponse(
                        suggestion.getId(),
                        suggestion.getProjectTitle(),
                        suggestion.getProjectType(),
                        suggestion.getStatus().name(),
                        suggestion.getAiModel(),
                        suggestion.getCreatedAt(),
                        suggestion.getUpdatedAt()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SuggestionListItemResponse> getSuggestionsByStatus(
            SuggestionStatus status
    ) {
        return aiSuggestionRepository.findByStatus(status)
                .stream()
                .map(suggestion -> new SuggestionListItemResponse(
                        suggestion.getId(),
                        suggestion.getProjectTitle(),
                        suggestion.getProjectType(),
                        suggestion.getStatus().name(),
                        suggestion.getAiModel(),
                        suggestion.getCreatedAt(),
                        suggestion.getUpdatedAt()
                ))
                .toList();
    }

    @Transactional
    public SuggestionDetailResponse updateSuggestion(
            Long suggestionId,
            UpdateSuggestionRequest request
    ) {
        // 1. Find suggestion
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found with ID: " + suggestionId
                ));

        // 2. Check status
        if (!suggestion.getStatus().canEdit()) {
            throw new IllegalStateException(
                    "Suggestion cannot be edited in current status: "
                            + suggestion.getStatus()
            );
        }

        // 3. Validate edited output
        templateOutputValidator.validate(request.output());

        // 4. Convert output object to JSON
        String generatedContent;
        try {
            generatedContent = objectMapper.writeValueAsString(request.output());
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(
                    "Failed to serialize generated template output", e
            );
        }

        // 5. Update only generatedContent
        suggestion.setGeneratedContent(generatedContent);

        // 6. Save updated suggestion
        AiSuggestion updatedSuggestion = aiSuggestionRepository.save(suggestion);

        // 7. Return updated detail
        return new SuggestionDetailResponse(
                updatedSuggestion.getId(),
                updatedSuggestion.getProjectTitle(),
                updatedSuggestion.getProjectDescription(),
                updatedSuggestion.getProjectType(),
                updatedSuggestion.getAdditionalRequirements(),
                updatedSuggestion.getStatus().name(),
                request.output(),
                updatedSuggestion.getAiModel(),
                updatedSuggestion.getCreatedAt(),
                updatedSuggestion.getUpdatedAt()
        );
    }

    @Transactional
    public SuggestionDetailResponse approveSuggestion(Long suggestionId) {

        // 1. Find suggestion
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found with ID: " + suggestionId
                ));

        // 2. Check current status
        if (!suggestion.getStatus()
                .canTransitionTo(SuggestionStatus.APPROVED)) {
            throw new IllegalStateException(
                    "Cannot approve suggestion from status: "
                            + suggestion.getStatus()
            );
        }

        // 3. Change status
        suggestion.setStatus(SuggestionStatus.APPROVED);

        // 4. Save
        AiSuggestion approvedSuggestion = aiSuggestionRepository.save(suggestion);

        // 5. Parse generated content
        GeneratedTemplateOutput output =
                templateOutputParser.parse(approvedSuggestion.getGeneratedContent());

        // 6. Return detail
        return new SuggestionDetailResponse(
                approvedSuggestion.getId(),
                approvedSuggestion.getProjectTitle(),
                approvedSuggestion.getProjectDescription(),
                approvedSuggestion.getProjectType(),
                approvedSuggestion.getAdditionalRequirements(),
                approvedSuggestion.getStatus().name(),
                output,
                approvedSuggestion.getAiModel(),
                approvedSuggestion.getCreatedAt(),
                approvedSuggestion.getUpdatedAt()
        );
    }

    @Transactional
    public SuggestionDetailResponse rejectSuggestion(
            Long suggestionId,
            RejectSuggestionRequest request
    ) {
        // 1. Find suggestion
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found with ID: " + suggestionId
                ));

        // 2. Check current status
        if (!suggestion.getStatus()
                .canTransitionTo(SuggestionStatus.REJECTED)) {
            throw new IllegalStateException(
                    "Cannot reject suggestion from status: "
                            + suggestion.getStatus()
            );
        }

        // 3. Update status and rejection reason
        suggestion.setStatus(SuggestionStatus.REJECTED);
        suggestion.setRejectionReason(request.reason());

        // 4. Save
        AiSuggestion rejectedSuggestion = aiSuggestionRepository.save(suggestion);

        // 5. Parse generated content
        GeneratedTemplateOutput output =
                templateOutputParser.parse(rejectedSuggestion.getGeneratedContent());

        // 6. Return detail
        return new SuggestionDetailResponse(
                rejectedSuggestion.getId(),
                rejectedSuggestion.getProjectTitle(),
                rejectedSuggestion.getProjectDescription(),
                rejectedSuggestion.getProjectType(),
                rejectedSuggestion.getAdditionalRequirements(),
                rejectedSuggestion.getStatus().name(),
                output,
                rejectedSuggestion.getAiModel(),
                rejectedSuggestion.getCreatedAt(),
                rejectedSuggestion.getUpdatedAt()
        );
    }

    @Transactional(readOnly = true)
    public GeneratedTemplateOutput getApprovedOutput(Long suggestionId) {

        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found with ID: " + suggestionId
                ));

        if (suggestion.getStatus() != SuggestionStatus.APPROVED) {
            throw new IllegalStateException(
                    "Only APPROVED suggestions can be applied"
            );
        }

        return templateOutputParser.parse(suggestion.getGeneratedContent());
    }

    @Transactional
    public void markApplied(Long suggestionId) {
        AiSuggestion suggestion = aiSuggestionRepository.findById(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found: " + suggestionId
                ));

        if (!suggestion.getStatus().canTransitionTo(SuggestionStatus.APPLIED)) {
            throw new IllegalStateException(
                    "Only APPROVED suggestions can be marked as APPLIED"
            );
        }

        suggestion.setStatus(SuggestionStatus.APPLIED);

        aiSuggestionRepository.save(suggestion);
    }

    @Transactional
    public GeneratedTemplateOutput getApprovedOutputForApply(Long suggestionId) {

        // 1. Find and lock Suggestion
        AiSuggestion suggestion = aiSuggestionRepository.findByIdForUpdate(suggestionId)
                .orElseThrow(() -> new EntityNotFoundException(
                        "AI Suggestion not found: " + suggestionId
                ));

        // 2. Check Suggestion status
        if (suggestion.getStatus() != SuggestionStatus.APPROVED) {
            throw new IllegalStateException(
                    "Only APPROVED suggestions can be applied"
            );
        }

        // 3. Parse AI generated content
        return templateOutputParser.parse(suggestion.getGeneratedContent());
    }
}