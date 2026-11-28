package com.example.starter_project_2025.system.demo.aitutor;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.aitutor.AiTutorDTO.ChatRequest;
import com.example.starter_project_2025.system.demo.aitutor.AiTutorDTO.ChatResponse;
import com.example.starter_project_2025.system.demo.aitutor.AiTutorDTO.QuizRequest;
import com.example.starter_project_2025.system.demo.aitutor.AiTutorDTO.QuizResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/ai/tutor/enrollments/{enrollmentId}/lessons/{lessonId}")
@Tag(name = "AI Tutor", description = "Lesson-grounded tutor chat and practice quiz for enrolled learners")
public class AiTutorController {

    private final AiTutorService service;

    /** Ask the tutor a question about the lesson. Nothing is saved. */
    @PostMapping("/chat")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_READ')")
    public ResponseEntity<ChatResponse> chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @Valid @RequestBody ChatRequest request) {
        return ResponseEntity.ok(service.chat(userId(principal), enrollmentId, lessonId, request));
    }

    /** Builds a practice quiz from the lesson text. Not graded and not stored. */
    @PostMapping("/quiz")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_READ')")
    public ResponseEntity<QuizResponse> quiz(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @Valid @RequestBody(required = false) QuizRequest request) {
        return ResponseEntity.status(HttpStatus.OK)
                .body(service.generateQuiz(userId(principal), enrollmentId, lessonId, request));
    }

    private Long userId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}
