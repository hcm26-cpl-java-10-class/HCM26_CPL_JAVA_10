package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/learning/me/insights")
@PreAuthorize("hasAuthority('LEARNER_ACCESS') and hasAuthority('LEARNING_SELF_READ')")
@RequiredArgsConstructor
@Tag(name = "User Profile", description = "API For")
public class LearningInsightsController {
    private final LearningInsightsService insights;
    private final LearningPlanService plans;

    public record Insights(LearningInsightsService.Snapshot snapshot, String nextStep,
                           boolean hasEvidence, boolean aiAvailable) {}

    @GetMapping
    public ResponseEntity<Insights> mine(Authentication authentication) {
        Long userId = userId(authentication);
        var snapshot = snapshot(authentication, userId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(new Insights(snapshot, insights.nextStep(snapshot), snapshot.hasEvidence(), plans.isAvailable()));
    }

    @PostMapping("/plan")
    public ResponseEntity<LearningPlanService.Plan> generatePlan(Authentication authentication) {
        Long userId = userId(authentication);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(plans.generate(userId, snapshot(authentication, userId)));
    }

    private Long userId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof UserPrincipal principal
                && principal.getUser() != null && principal.getUser().getId() != null) {
            return principal.getUser().getId();
        }
        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
    }

    private LearningInsightsService.Snapshot snapshot(Authentication authentication, Long userId) {
        Set<String> permissions = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        return insights.snapshot(userId, permissions.contains("LESSON_PROGRESS_READ"), permissions.contains("EXAM_TAKE"));
    }
}
