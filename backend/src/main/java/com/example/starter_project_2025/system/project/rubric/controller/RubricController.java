package com.example.starter_project_2025.system.project.rubric.controller;

import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.dto.*;
import com.example.starter_project_2025.system.project.rubric.service.RubricService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/api/rubrics")
@RequiredArgsConstructor
public class RubricController {
    private final RubricService service;

    @GetMapping
    @PreAuthorize("hasAuthority('RUBRIC_READ')")
    public RubricPageResponse getList(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(required = false) String search,
                                      @RequestParam(required = false) RubricVersionStatus status) {
        return service.getList(page, size, search, status);
    }

    @PostMapping
    @PreAuthorize("hasAuthority('RUBRIC_CREATE')")
    public ResponseEntity<RubricDetailResponse> create(@Valid @RequestBody SaveRubricDraftRequest request) {
        RubricDetailResponse response = service.create(request);
        return ResponseEntity.created(URI.create("/api/rubrics/" + response.id())).body(response);
    }

    @GetMapping("/{rubricId}")
    @PreAuthorize("hasAuthority('RUBRIC_READ')")
    public RubricDetailResponse getDetail(@PathVariable UUID rubricId) { return service.getDetail(rubricId); }

    @PutMapping("/{rubricId}/versions/{versionId}")
    @PreAuthorize("hasAuthority('RUBRIC_UPDATE')")
    public RubricDetailResponse updateDraft(@PathVariable UUID rubricId, @PathVariable UUID versionId,
                                             @Valid @RequestBody SaveRubricDraftRequest request) {
        return service.updateDraft(rubricId, versionId, request);
    }

    @PostMapping("/{rubricId}/versions/{versionId}/publish")
    @PreAuthorize("hasAuthority('RUBRIC_UPDATE')")
    public RubricDetailResponse publish(@PathVariable UUID rubricId, @PathVariable UUID versionId) {
        return service.publish(rubricId, versionId);
    }

    @PostMapping("/{rubricId}/versions")
    @PreAuthorize("hasAuthority('RUBRIC_CREATE')")
    public RubricDetailResponse createVersion(@PathVariable UUID rubricId,
                                               @Valid @RequestBody CreateRubricVersionRequest request) {
        return service.createVersion(rubricId, request);
    }

    @PostMapping("/{rubricId}/versions/{versionId}/archive")
    @PreAuthorize("hasAuthority('RUBRIC_UPDATE')")
    public RubricDetailResponse archive(@PathVariable UUID rubricId, @PathVariable UUID versionId) {
        return service.archive(rubricId, versionId);
    }

    @DeleteMapping("/{rubricId}/versions/{versionId}")
    @PreAuthorize("hasAuthority('RUBRIC_DELETE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDraft(@PathVariable UUID rubricId, @PathVariable UUID versionId) {
        service.deleteDraft(rubricId, versionId);
    }
}
