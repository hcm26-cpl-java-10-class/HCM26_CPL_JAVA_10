package com.example.starter_project_2025.system.project.aiassistant.controller;

import com.example.starter_project_2025.system.project.aiassistant.dto.request.RejectSuggestionRequest;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.AIReviewSuggestionApplyResponse;
import com.example.starter_project_2025.system.project.aiassistant.dto.response.AIReviewSuggestionResponse;
import com.example.starter_project_2025.system.project.aiassistant.service.apply.AIReviewSuggestionApplyService;
import com.example.starter_project_2025.system.project.aiassistant.service.review.AIReviewSuggestionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/project-templates/{templateId}/reviews/{reportId}/findings/{findingId}/suggestions")
@PreAuthorize("hasAuthority('PROJECT_TEMPLATE_REVIEW')")
@RequiredArgsConstructor
public class AIReviewSuggestionController {

    private final AIReviewSuggestionService suggestionService;
    private final AIReviewSuggestionApplyService applyService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AIReviewSuggestionResponse generate(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId
    ) {
        return suggestionService.generate(templateId, reportId, findingId);
    }

    @PostMapping("/{suggestionId}/regenerate")
    @ResponseStatus(HttpStatus.CREATED)
    public AIReviewSuggestionResponse regenerate(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @PathVariable Long suggestionId
    ) {
        suggestionService.get(templateId, reportId, findingId, suggestionId);
        return suggestionService.generate(templateId, reportId, findingId);
    }

    @GetMapping
    public List<AIReviewSuggestionResponse> listByFinding(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId
    ) {
        return suggestionService.listByFinding(templateId, reportId, findingId);
    }

    @GetMapping("/{suggestionId}")
    public AIReviewSuggestionResponse get(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @PathVariable Long suggestionId
    ) {
        return suggestionService.get(templateId, reportId, findingId, suggestionId);
    }

    @PatchMapping("/{suggestionId}/approve")
    public AIReviewSuggestionResponse approve(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @PathVariable Long suggestionId
    ) {
        return suggestionService.approve(templateId, reportId, findingId, suggestionId);
    }

    @PatchMapping("/{suggestionId}/reject")
    public AIReviewSuggestionResponse reject(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @PathVariable Long suggestionId,
            @Valid @RequestBody RejectSuggestionRequest request
    ) {
        return suggestionService.reject(
                templateId, reportId, findingId, suggestionId, request.reason());
    }

    @PostMapping("/{suggestionId}/apply")
    public ResponseEntity<AIReviewSuggestionApplyResponse> apply(
            @PathVariable Long templateId,
            @PathVariable Long reportId,
            @PathVariable Long findingId,
            @PathVariable Long suggestionId
    ) {
        AIReviewSuggestionApplyResponse response = applyService.applySuggestion(
                templateId, reportId, findingId, suggestionId);
        if (response.snapshot() == null) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }
        return ResponseEntity.ok(response);
    }
}
