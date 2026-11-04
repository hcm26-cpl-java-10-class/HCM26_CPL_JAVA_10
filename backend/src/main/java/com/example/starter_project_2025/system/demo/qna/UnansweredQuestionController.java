package com.example.starter_project_2025.system.demo.qna;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/qna/unanswered")
@RequiredArgsConstructor
@Tag(name = "Unanswered Q&A", description = "Questions awaiting an answer, across all courses the instructor teaches")
public class UnansweredQuestionController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final UnansweredQuestionService unansweredService;

    /** Quyền trả lời (LESSON_ANSWER_CREATE) chính là quyền của giảng viên / admin, học viên không có. */
    @GetMapping
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<Page<UnansweredQuestionDTO>> getUnanswered(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) Long courseId,
            @RequestParam(name = "q", required = false) String keyword,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        return ResponseEntity.ok(unansweredService.getUnanswered(viewer(principal), courseId, keyword, pageable));
    }

    @GetMapping("/courses")
    @PreAuthorize("hasAuthority('LESSON_ANSWER_CREATE')")
    public ResponseEntity<List<CourseUnansweredCount>> getCourseCounts(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(unansweredService.countByCourse(viewer(principal)));
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
