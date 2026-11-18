package com.example.starter_project_2025.system.demo.lessonreport;

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
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/lesson-reports")
@RequiredArgsConstructor
@Tag(name = "Lesson Reports Inbox", description = "Reports across all courses the instructor teaches (admin: all)")
public class LessonReportInboxController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final LessonReportService reportService;

    @GetMapping
    @PreAuthorize("hasAuthority('LESSON_REPORT_READ')")
    public ResponseEntity<Page<LessonReportInboxDTO>> inbox(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) LessonReportStatus status,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        return ResponseEntity.ok(reportService.inbox(viewer(principal), status, pageable));
    }

    @PatchMapping("/{reportId}/resolve")
    @PreAuthorize("hasAuthority('LESSON_REPORT_UPDATE')")
    public ResponseEntity<LessonReportInboxDTO> resolve(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long reportId
    ) {
        return ResponseEntity.ok(reportService.resolve(viewer(principal), reportId));
    }

    private LessonReportService.Viewer viewer(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        boolean administrator = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ADMIN_ROLE::equals);
        return new LessonReportService.Viewer(principal.getUser().getId(), administrator);
    }
}
