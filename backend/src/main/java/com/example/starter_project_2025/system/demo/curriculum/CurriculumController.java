package com.example.starter_project_2025.system.demo.curriculum;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/courses/{courseId}/curriculum")
@RequiredArgsConstructor
@Tag(name = "Curriculum", description = "Curriculum tree, publish validation and batch reorder")
public class CurriculumController {

    private final CurriculumService curriculumService;

    @GetMapping
    @PreAuthorize("hasAuthority('SECTION_READ') and hasAuthority('LESSON_READ')")
    @Operation(summary = "Get the curriculum tree (sections -> lessons, ordered)")
    public ResponseEntity<CurriculumTreeDTO> getTree(@PathVariable Long courseId) {
        return ResponseEntity.ok(curriculumService.getTree(courseId));
    }

    @GetMapping("/validate-publish")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    @Operation(summary = "Check whether the course curriculum satisfies publish rules")
    public ResponseEntity<CurriculumValidationResult> validatePublish(@PathVariable Long courseId) {
        return ResponseEntity.ok(curriculumService.validatePublish(courseId));
    }

    @PutMapping("/reorder")
    @PreAuthorize("hasAuthority('SECTION_UPDATE') and hasAuthority('LESSON_UPDATE')")
    @Operation(summary = "Batch reorder sections/lessons and move lessons between sections")
    public ResponseEntity<CurriculumTreeDTO> reorder(
            @PathVariable Long courseId,
            @Valid @RequestBody CurriculumReorderRequest request
    ) {
        return ResponseEntity.ok(curriculumService.reorder(courseId, request));
    }
}