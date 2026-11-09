package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class LearningRecordsController {
    private final LearningRecordsService records;

    @GetMapping("/learning/me")
    @PreAuthorize("hasAuthority('LEARNER_ACCESS') and hasAuthority('LEARNING_SELF_READ')")
    public LearningRecordsService.Records mine(@AuthenticationPrincipal UserPrincipal principal) {
        return records.forUser(principal.getUser().getId());
    }

    // USER_READ is the existing global user scope. No department-scoped user policy exists.
    @GetMapping("/users/{userId}/learning")
    @PreAuthorize("hasAuthority('ADMIN_ACCESS') and hasAuthority('USER_READ') and hasAuthority('USER_LEARNING_READ')")
    public LearningRecordsService.Records user(@PathVariable Long userId) {
        return records.forUser(userId);
    }
}
