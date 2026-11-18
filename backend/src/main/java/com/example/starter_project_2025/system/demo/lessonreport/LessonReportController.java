package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.security.UserPrincipal;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
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
@RequestMapping("/api/lessons/{lessonId}/reports")
@RequiredArgsConstructor
@Tag(name = "Lesson Reports", description = "Students report problems in a lesson")
public class LessonReportController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";

    private final LessonReportService reportService;

    @PostMapping
    @PreAuthorize("hasAuthority('LESSON_REPORT_CREATE')")
    public ResponseEntity<LessonReportDTO> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @Valid @RequestBody LessonReportDTO.CreateRequest request
    ) {
        LessonReportDTO created = reportService.create(
                viewer(principal), lessonId, request.reason(), request.detail());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    @PreAuthorize("hasAuthority('LESSON_REPORT_READ')")
    public ResponseEntity<Page<LessonReportDTO>> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long lessonId,
            @PageableDefault(size = 10) Pageable pageable
    ) {
        return ResponseEntity.ok(reportService.list(viewer(principal), lessonId, pageable));
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
