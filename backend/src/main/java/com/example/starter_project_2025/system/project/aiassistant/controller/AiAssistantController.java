package com.example.starter_project_2025.system.project.aiassistant.controller;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.GenerateTemplateResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;

import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.AiSuggestionService;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.GeneratedSuggestionResult;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ai-assistant")
@Tag(name = "AI Assistant",
        description = "Endpoints for AI-assisted project template generation")
public class AiAssistantController {

    private final AiSuggestionService aiSuggestionService;

    public AiAssistantController(AiSuggestionService aiSuggestionService) {
        this.aiSuggestionService = aiSuggestionService;
    }

    @PostMapping("/templates/generate")
    public ResponseEntity<GenerateTemplateResponse> generateTemplate(
            @Valid @RequestBody GenerateTemplateRequest request
    ) {

        //Generate and save AI suggestion
        GeneratedSuggestionResult result =
                aiSuggestionService.generateAndSave(request);

        return ResponseEntity.ok(
                new GenerateTemplateResponse(
                        result.suggestion().getId(),
                        result.suggestion().getStatus().name(),
                        result.output(),
                        result.suggestion().getAiModel(),
                        result.suggestion().getCreatedAt()
                )
        );
    }
}