package com.example.starter_project_2025.system.project.rubric.controller;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.dto.*;
import com.example.starter_project_2025.system.project.rubric.service.RubricService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/rubrics")
@RequiredArgsConstructor
public class RubricController {
    private final RubricService service;

    @GetMapping
    public RubricPageResponse getList(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String search,
                                      @RequestParam(required = false) RubricVersionStatus status) {
        return service.getList(page, size, search, status);
    }

    @PostMapping
    public ResponseEntity<RubricDetailResponse> create(@Valid @RequestBody SaveRubricDraftRequest request) {
        RubricDetailResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/rubrics/" + response.id())).body(response);
    }

    @GetMapping("/{rubricId}")
    public RubricDetailResponse getDetail(@PathVariable UUID rubricId) { return service.getDetail(rubricId); }

    @PutMapping("/{rubricId}/versions/{versionId}")
    public RubricDetailResponse updateDraft(@PathVariable UUID rubricId, @PathVariable UUID versionId,
                                             @Valid @RequestBody SaveRubricDraftRequest request) {
        return service.updateDraft(rubricId, versionId, request);
    }

    @PostMapping("/{rubricId}/versions/{versionId}/publish")
    public RubricDetailResponse publish(@PathVariable UUID rubricId, @PathVariable UUID versionId) {
        return service.publish(rubricId, versionId);
    }

    @PostMapping("/{rubricId}/versions")
    public RubricDetailResponse createVersion(@PathVariable UUID rubricId,
                                               @Valid @RequestBody CreateRubricVersionRequest request) {
        return service.createVersion(rubricId, request);
    }

    @DeleteMapping("/{rubricId}/versions/{versionId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraft(@PathVariable UUID rubricId, @PathVariable UUID versionId) {
        service.deleteDraft(rubricId, versionId);
    }
}
