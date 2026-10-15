package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/progress")
@Tag(name = "Lesson Progress", description = "Lesson completion tracking APIs")
public class LessonProgressController {

    private final LessonProgressService progressService;

    public LessonProgressController(LessonProgressService progressService) {
        this.progressService = progressService;
    }

    @GetMapping("/enrollments/{enrollmentId}")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_READ')")
    public List<LessonProgressDTO> getProgress(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId
    ) {
        return progressService.getProgress(getUserId(principal), enrollmentId);
    }

    @PutMapping("/enrollments/{enrollmentId}/lessons/{lessonId}")
    @PreAuthorize("hasAuthority('LESSON_PROGRESS_UPDATE')")
    public LessonProgressDTO setCompleted(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long enrollmentId,
            @PathVariable Long lessonId,
            @Valid @RequestBody UpdateProgressRequest request
    ) {
        return progressService.setCompleted(
                getUserId(principal),
                enrollmentId,
                lessonId,
                request.completed()
        );
    }

    private Long getUserId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }

    public record UpdateProgressRequest(@NotNull Boolean completed) {
    }
}
