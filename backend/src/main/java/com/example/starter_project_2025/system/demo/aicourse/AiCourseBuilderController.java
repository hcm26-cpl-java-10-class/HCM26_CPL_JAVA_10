package com.example.starter_project_2025.system.demo.aicourse;

import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ApplyRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ApplyResult;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ChatRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ChatResponse;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.DraftContentRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.GenerateContentRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.GenerateContentResponse;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.OptionsResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai/course-builder")
@Tag(name = "AI Course Builder", description = "Design a course with AI, then create it after the user confirms")
public class AiCourseBuilderController {

    private final AiCourseBuilderService service;

    /** Teachers and categories for the pickers in the AI window. */
    @GetMapping("/options")
    @PreAuthorize("hasAuthority('COURSE_CREATE')")
    public ResponseEntity<OptionsResponse> options() {
        return ResponseEntity.ok(service.options());
    }

    /** Chat turn: AI asks a question or returns up to 3 outline options. Nothing is saved. */
    @PostMapping("/chat")
    @PreAuthorize("hasAuthority('COURSE_CREATE')")
    public ResponseEntity<ChatResponse> chat(@Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(service.chat(request));
    }

    /** Creates the chosen outline as a DRAFT course with sections and lessons. */
    @PostMapping("/apply")
    @PreAuthorize("hasAuthority('COURSE_CREATE') and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public ResponseEntity<ApplyResult> apply(@Valid @RequestBody ApplyRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.apply(request));
    }

    /** Writes the full text of an existing lesson (and saves it when save = true). */
    @PostMapping("/lessons/{lessonId}/generate-content")
    @PreAuthorize("hasAuthority('LESSON_UPDATE')")
    public ResponseEntity<GenerateContentResponse> generateLessonContent(
            @PathVariable Long lessonId,
            @RequestBody(required = false) GenerateContentRequest request) {
        return ResponseEntity.ok(service.generateLessonContent(lessonId, request));
    }

    /** Drafts lesson text from the lesson form (works before the lesson is saved). Nothing is saved. */
    @PostMapping("/sections/{sectionId}/draft-lesson-content")
    @PreAuthorize("hasAnyAuthority('LESSON_CREATE', 'LESSON_UPDATE')")
    public ResponseEntity<GenerateContentResponse> draftLessonContent(
            @PathVariable Long sectionId,
            @Valid @RequestBody DraftContentRequest request) {
        return ResponseEntity.ok(service.draftLessonContent(sectionId, request));
    }
}