package com.example.starter_project_2025.system.demo.recommendation;
import com.example.starter_project_2025.security.UserPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static com.example.starter_project_2025.system.demo.recommendation.RecommendationModels.*;

@RestController @RequestMapping("/api/course-recommendations") @RequiredArgsConstructor @Validated
@PreAuthorize("hasAuthority('COURSE_READ') and hasAuthority('ENROLLMENT_CREATE')")
public class RecommendationController {
    private final RecommendationService service;
    private final RecommendationData data;
    static Long account(UserPrincipal p) {
        if (p==null || p.getUser()==null || !Boolean.TRUE.equals(p.getUser().getIsActive()))
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"Please log in");
        return p.getUser().getId();
    }
    @GetMapping public Result get(@AuthenticationPrincipal UserPrincipal p) { return service.automatic(account(p)); }
    @PutMapping("/preferences") public Preferences save(@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody Preferences request) { return data.save(account(p),request); }
    @PostMapping("/dismiss/{courseId}") public void dismiss(@AuthenticationPrincipal UserPrincipal p,@PathVariable @Positive Long courseId) { data.dismiss(account(p),courseId); }
    @DeleteMapping("/preferences") public void reset(@AuthenticationPrincipal UserPrincipal p) { data.reset(account(p)); }
    @PostMapping("/chat") public ChatResponse chat(@AuthenticationPrincipal UserPrincipal p,@Valid @RequestBody ChatRequest request) { return service.ask(account(p),request); }
}
