package com.example.starter_project_2025.system.project.aiassistant.controller;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.GenerateTemplateRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.RejectSuggestionRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.request.UpdateSuggestionRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.GenerateTemplateResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.SuggestionDetailResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.SuggestionListItemResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.output.GeneratedTemplateOutput;

import com.example.starter_project_2025.system.project.aiassistant.entity.AiSuggestion;
import com.example.starter_project_2025.system.project.aiassistant.enums.SuggestionStatus;
import com.example.starter_project_2025.system.project.aiassistant.service.apply.AIApplyService;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.AiSuggestionService;
import com.example.starter_project_2025.system.project.aiassistant.service.generation.GeneratedSuggestionResult;
import com.example.starter_project_2025.system.project.template.ProjectTemplateResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai-assistant")
@PreAuthorize("hasAnyRole('MENTOR', 'ADMIN')")
@Tag(name = "AI Assistant",
        description = "Endpoints for AI-assisted project template generation")
public class AiAssistantController {

    private final AiSuggestionService aiSuggestionService;
    private final AIApplyService aiApplyService;

    public AiAssistantController(
            AiSuggestionService aiSuggestionService,
            AIApplyService aiApplyService
    ) {
        this.aiSuggestionService = aiSuggestionService;
        this.aiApplyService = aiApplyService;
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

    @GetMapping("/suggestions/{id}")
    public ResponseEntity<SuggestionDetailResponse> getSuggestionDetail(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                aiSuggestionService.getSuggestionDetail(id)
        );
    }

    @GetMapping("/suggestions")
    public ResponseEntity<List<SuggestionListItemResponse>> getSuggestions(
            @RequestParam(required = false) SuggestionStatus status
    ) {
        if (status == null) {
            return ResponseEntity.ok(
                    aiSuggestionService.getAllSuggestions()
            );
        }

        return ResponseEntity.ok(
                aiSuggestionService.getSuggestionsByStatus(status)
        );
    }

    @PutMapping("/suggestions/{id}")
    public ResponseEntity<SuggestionDetailResponse> updateSuggestion(
            @PathVariable Long id,
            @Valid @RequestBody UpdateSuggestionRequest request
    ) {
        return ResponseEntity.ok(
                aiSuggestionService.updateSuggestion(id, request)
        );
    }

    @PatchMapping("/suggestions/{id}/approve")
    public ResponseEntity<SuggestionDetailResponse> approveSuggestion(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                aiSuggestionService.approveSuggestion(id)
        );
    }

    @PatchMapping("/suggestions/{id}/reject")
    public ResponseEntity<SuggestionDetailResponse> rejectSuggestion(
            @PathVariable Long id,
            @Valid @RequestBody RejectSuggestionRequest request
    ) {
        return ResponseEntity.ok(
                aiSuggestionService.rejectSuggestion(id, request)
        );
    }

    @PostMapping("/suggestions/{id}/apply")
    public ResponseEntity<ProjectTemplateResponse> applySuggestion(
            @PathVariable Long id
    ) {
        return ResponseEntity.ok(
                aiApplyService.applyApprovedSuggestion(id)
        );
    }

}