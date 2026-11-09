package com.example.starter_project_2025.system.demo.aicourse;

import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ApplyRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ApplyResult;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ChatRequest;
import com.example.starter_project_2025.system.demo.aicourse.AiCourseBuilderDTO.ChatResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
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
}