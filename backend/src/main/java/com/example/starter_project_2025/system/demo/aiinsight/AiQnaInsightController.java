package com.example.starter_project_2025.system.demo.aiinsight;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.aiinsight.AiQnaInsightDTO.CourseInsightResponse;
import com.example.starter_project_2025.system.demo.aiinsight.AiQnaInsightDTO.InsightChatRequest;
import com.example.starter_project_2025.system.demo.aiinsight.AiQnaInsightDTO.InsightChatResponse;
import com.example.starter_project_2025.system.demo.aiinsight.AiQnaInsightDTO.SupplementRequest;
import com.example.starter_project_2025.system.demo.aiinsight.AiQnaInsightDTO.SupplementResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ai/insights")
@RequiredArgsConstructor
@Tag(name = "AI Q&A Insight", description = "Find where students get stuck from their lesson questions")
public class AiQnaInsightController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final AiQnaInsightService service;

    /** First screen of the chat: statistics and charts calculated by the system (no AI call). */
    @GetMapping("/courses/{courseId}/overview")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<InsightChatResponse> overview(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long courseId) {
        requirePrincipal(principal);
        return ResponseEntity.ok(service.overview(principal.getUser().getId(), isAdministrator(principal), courseId));
    }

    /** Ask the AI about the course's student questions; the answer comes with charts and percentages. */
    @PostMapping("/courses/{courseId}/chat")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<InsightChatResponse> chat(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long courseId,
            @Valid @RequestBody InsightChatRequest request) {
        requirePrincipal(principal);
        return ResponseEntity.ok(service.chat(principal.getUser().getId(), isAdministrator(principal), courseId, request));
    }

    /** Same permission as answering questions (LESSON_ANSWER_CREATE): instructors and admins, not students. */
    @GetMapping("/courses/{courseId}/student-questions")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<CourseInsightResponse> analyze(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long courseId,
            @RequestParam(defaultValue = "false") boolean refresh,
            @RequestParam(required = false) String language) {
        requirePrincipal(principal);
        return ResponseEntity.ok(service.analyze(
                principal.getUser().getId(), isAdministrator(principal), courseId, refresh, language));
    }

    /** Writes (or appends) an extra explanation to a TEXT lesson. */
    @PostMapping("/lessons/{lessonId}/supplement")
    @PreAuthorize("hasAuthority('LESSON_UPDATE')")
    public ResponseEntity<SupplementResponse> supplement(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @Valid @RequestBody SupplementRequest request) {
        requirePrincipal(principal);
        return ResponseEntity.ok(service.supplement(
                principal.getUser().getId(), isAdministrator(principal), lessonId, request));
    }

    private static void requirePrincipal(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
    }

    private static boolean isAdministrator(UserPrincipal principal) {
        return principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ADMIN_ROLE::equals);
    }
}