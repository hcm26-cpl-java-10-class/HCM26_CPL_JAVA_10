package com.example.starter_project_2025.system.demo.bookmark;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.lesson.CatalogCourseDTO;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Positive;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/course-bookmarks")
@RequiredArgsConstructor
@Validated
@Tag(name = "Course Bookmarks", description = "Save and browse bookmarked courses for the current user")
public class CourseBookmarkController {

    private final CourseBookmarkService bookmarkService;

    @GetMapping("/ids")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<List<Long>> getSavedIds(@AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(bookmarkService.getSavedCourseIds(requireUserId(principal)));
    }

    @GetMapping
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<Page<CatalogCourseDTO>> getSavedCourses(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) CourseLevel level,
            @PageableDefault(size = 12) Pageable pageable
    ) {
        return ResponseEntity.ok(bookmarkService.getSavedCourses(
                requireUserId(principal), search, categoryId, level, pageable));
    }

    @PostMapping("/{courseId}")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<CourseBookmarkStatusResponse> save(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable @Positive Long courseId
    ) {
        return ResponseEntity.ok(bookmarkService.save(requireUserId(principal), courseId));
    }

    @DeleteMapping("/{courseId}")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<CourseBookmarkStatusResponse> remove(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable @Positive Long courseId
    ) {
        return ResponseEntity.ok(bookmarkService.remove(requireUserId(principal), courseId));
    }

    private static Long requireUserId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null || !Boolean.TRUE.equals(principal.getUser().getIsActive())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}
