
package com.example.starter_project_2025.system.demo.learning_note;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/learning-notes")
@Tag(name = "Learning Note", description = "Learning note APIs")
public class LearningNoteController {

    private final LearningNoteService learningNoteService;

    @org.springframework.security.access.prepost.PreAuthorize("hasAuthority('LEARNER_ACCESS')")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LearningNoteResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody LearningNoteDTO request
    ) {

        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(
                    HttpStatus.UNAUTHORIZED,
                    "Please log in first"
            );
        }

        Long userId = principal.getUser().getId();

        LearningNote note = learningNoteService.create(
                userId,
                request
        );

        return new LearningNoteResponse(
                note.getId(),
                note.getCourseId(),
                note.getContent(),
                note.getCreatedAt()
        );
    }
}
