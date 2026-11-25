package com.example.starter_project_2025.system.learning.roadmap;

import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import static com.example.starter_project_2025.system.learning.roadmap.LearningRoadmapService.RoadmapView;

@RestController
@RequestMapping("/api/learning/me/roadmap")
@PreAuthorize("hasAuthority('LEARNER_ACCESS') and hasAuthority('LEARNING_SELF_READ') and hasAuthority('COURSE_READ')")
@RequiredArgsConstructor
public class LearningRoadmapController {
    private final LearningRoadmapService roadmaps;

    public record GoalRequest(@NotNull @Valid RoadmapGoal goal, Long revision) {}
    public record GenerationRequest(@NotNull Long revision, Boolean ruleBased) {}
    public record AdviceRequest(@NotNull Long revision) {}

    @GetMapping
    public ResponseEntity<RoadmapView> mine(@AuthenticationPrincipal UserPrincipal principal) {
        return response(roadmaps.get(userId(principal)));
    }

    @PutMapping("/goal")
    public ResponseEntity<RoadmapView> save(@AuthenticationPrincipal UserPrincipal principal,
                                             @RequestBody @Valid GoalRequest request) {
        return response(roadmaps.saveGoal(userId(principal), request.goal(), request.revision()));
    }

    @PostMapping("/generate")
    public ResponseEntity<RoadmapView> generate(@AuthenticationPrincipal UserPrincipal principal,
                                                 @RequestBody @Valid GenerationRequest request) {
        return response(roadmaps.generate(userId(principal), request.revision(), !Boolean.FALSE.equals(request.ruleBased())));
    }

    @PostMapping("/advice")
    public ResponseEntity<RoadmapView> advise(@AuthenticationPrincipal UserPrincipal principal,
                                               @RequestBody @Valid AdviceRequest request) {
        return response(roadmaps.advise(userId(principal), request.revision()));
    }

    private ResponseEntity<RoadmapView> response(RoadmapView value) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(value);
    }

    private Long userId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null || principal.getUser().getId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}
