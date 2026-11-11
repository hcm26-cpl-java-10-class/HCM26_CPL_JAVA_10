package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/progress/enrollments")
@RequiredArgsConstructor
@Tag(name = "Lesson Progress", description = "Student lesson completion tracking")
public class LessonProgressController {

    private final LessonProgressService progressService;

    @GetMapping("/{enrollmentId}")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_READ')")
    public LessonProgressDTO getProgress(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId
    ) {
        return progressService.getProgress(getUserId(principal), enrollmentId);
    }

    @PutMapping("/{enrollmentId}/lessons/{lessonId}")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_UPDATE')")
    public LessonProgressDTO setCompleted(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @RequestBody UpdateProgressRequest request
    ) {
        if (request.completed() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "completed is required");
        }
        return progressService.setCompleted(
                getUserId(principal),
                enrollmentId,
                lessonId,
                request.completed()
        );
    }

    @PutMapping("/{enrollmentId}/lessons/{lessonId}/access")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_UPDATE')")
    public LessonProgressDTO recordAccess(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId
    ) {
        return progressService.recordAccess(getUserId(principal), enrollmentId, lessonId);
    }

    /** Ghi nhận thời gian học (giây) cho một bài — dùng để tính "số giờ học". */
    @PutMapping("/{enrollmentId}/lessons/{lessonId}/study-time")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_UPDATE')")
    public LessonProgressDTO addStudyTime(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @RequestBody UpdateStudyTimeRequest request
    ) {
        if (request.seconds() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "seconds is required");
        }
        return progressService.addStudyTime(
                getUserId(principal), enrollmentId, lessonId, request.seconds());
    }

    @PutMapping("/{enrollmentId}/lessons/{lessonId}/answer")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_UPDATE')")
    public LessonProgressDTO saveAnswer(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @RequestBody UpdateAnswerRequest request
    ) {
        return progressService.saveAnswer(getUserId(principal), enrollmentId, lessonId, request.answer());
    }

    @GetMapping("/{enrollmentId}/last-lesson")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_READ')")
    public LessonProgressDTO.LessonItem getLastLesson(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId
    ) {
        return progressService.getLastLesson(getUserId(principal), enrollmentId);
    }

    private Long getUserId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }

    public record UpdateProgressRequest(Boolean completed) {
    }

    public record UpdateAnswerRequest(String answer) {
    }

    public record UpdateStudyTimeRequest(Long seconds) {
    }
}
