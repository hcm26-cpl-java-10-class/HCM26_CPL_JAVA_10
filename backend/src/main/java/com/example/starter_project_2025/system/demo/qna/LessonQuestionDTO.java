package com.example.starter_project_2025.system.demo.qna;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;
import java.util.List;

public record LessonQuestionDTO(
        Long id,
        Long lessonId,
        String content,
        Long authorId,
        String authorName,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        boolean answered,
        boolean canEdit,
        boolean canDelete,
        boolean canAnswer,
        boolean pinned,
        LocalDateTime pinnedAt,
        int upvoteCount,
        boolean upvotedByMe,
        boolean canUpvote,
        boolean canPin,
        boolean canAccept,
        Long acceptedAnswerId,
        List<AnswerDTO> answers
) {

    public record AnswerDTO(
            Long id,
            Long questionId,
            String content,
            Long authorId,
            String authorName,
            boolean byInstructor,
            boolean accepted,
            LocalDateTime createdAt,
            LocalDateTime updatedAt,
            boolean canEdit,
            boolean canDelete
    ) {
    }

    public record QuestionRequest(
            @NotBlank(message = "Question must not be blank")
            @Size(max = LessonQnaService.MAX_CONTENT_LENGTH,
                    message = "Question must not exceed 2000 characters")
            String content
    ) {
    }

    public record AnswerRequest(
            @NotBlank(message = "Answer must not be blank")
            @Size(max = LessonQnaService.MAX_CONTENT_LENGTH,
                    message = "Answer must not exceed 2000 characters")
            String content
    ) {
    }
}