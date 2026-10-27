package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/lessons/{lessonId}/questions")
@RequiredArgsConstructor
@Tag(name = "Lesson Q&A", description = "Questions from students and answers from instructors, per lesson")
public class LessonQnaController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final LessonQnaService qnaService;

    @GetMapping
    @PreAuthorize("hasAuthority('LESSON_QUESTION_READ')")
    public ResponseEntity<Page<LessonQuestionDTO>> getQuestions(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        return ResponseEntity.ok(qnaService.getQuestions(viewer(principal), lessonId, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('LESSON_QUESTION_CREATE')")
    public ResponseEntity<LessonQuestionDTO> createQuestion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @Valid @RequestBody LessonQuestionDTO.QuestionRequest request
    ) {
        LessonQuestionDTO created = qnaService.createQuestion(viewer(principal), lessonId, request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{questionId}")
    @PreAuthorize("hasAuthority('LESSON_QUESTION_UPDATE')")
    public ResponseEntity<LessonQuestionDTO> updateQuestion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PathVariable Long questionId,
            @Valid @RequestBody LessonQuestionDTO.QuestionRequest request
    ) {
        return ResponseEntity.ok(
                qnaService.updateQuestion(viewer(principal), lessonId, questionId, request.content()));
    }

    @DeleteMapping("/{questionId}")
    @PreAuthorize("hasAuthority('LESSON_QUESTION_DELETE')")
    public ResponseEntity<Void> deleteQuestion(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PathVariable Long questionId
    ) {
        qnaService.deleteQuestion(viewer(principal), lessonId, questionId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{questionId}/answers")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<LessonQuestionDTO> createAnswer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PathVariable Long questionId,
            @Valid @RequestBody LessonQuestionDTO.AnswerRequest request
    ) {
        LessonQuestionDTO updated = qnaService.createAnswer(
                viewer(principal), lessonId, questionId, request.content());
        return ResponseEntity.status(HttpStatus.CREATED).body(updated);
    }

    @PutMapping("/{questionId}/answers/{answerId}")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_UPDATE')")
    public ResponseEntity<LessonQuestionDTO> updateAnswer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PathVariable Long questionId,
            @PathVariable Long answerId,
            @Valid @RequestBody LessonQuestionDTO.AnswerRequest request
    ) {
        return ResponseEntity.ok(qnaService.updateAnswer(
                viewer(principal), lessonId, questionId, answerId, request.content()));
    }

    @DeleteMapping("/{questionId}/answers/{answerId}")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_DELETE')")
    public ResponseEntity<LessonQuestionDTO> deleteAnswer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PathVariable Long questionId,
            @PathVariable Long answerId
    ) {
        return ResponseEntity.ok(
                qnaService.deleteAnswer(viewer(principal), lessonId, questionId, answerId));
    }

    private LessonQnaService.Viewer viewer(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        boolean administrator = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ADMIN_ROLE::equals);
        return new LessonQnaService.Viewer(principal.getUser().getId(), administrator);
    }
}