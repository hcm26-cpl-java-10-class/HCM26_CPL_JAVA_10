package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.category.CategoryService;
import com.example.starter_project_2025.system.demo.category.CategoryTreeDTO;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/catalog/courses")
@RequiredArgsConstructor
@Tag(name = "Course Catalog", description = "Published course catalog and course detail")
public class CourseCatalogController {

    private static final String ADMIN_ROLE = "ROLE_ADMIN";
    private static final String COURSE_MANAGEMENT_PERMISSION = "COURSE_UPDATE";

    private final CourseCatalogService catalogService;
    private final CategoryService categoryService;

    @GetMapping
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<Page<CatalogCourseDTO>> search(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) CourseLevel level,
            @PageableDefault(size = 12) Pageable pageable
    ) {
        return ResponseEntity.ok(
                catalogService.search(search, categoryId, level, pageable, getUserId(principal)));
    }

    /** Danh mục đang active để dựng bộ lọc catalog (STUDENT không có CATEGORY_READ nên không dùng /api/categories/tree). */
    @GetMapping("/categories")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<List<CategoryTreeDTO>> getCategories() {
        return ResponseEntity.ok(categoryService.getTree(true));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public ResponseEntity<CourseDetailDTO> getDetail(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        Long userId = getUserId(principal);
        var authorities = principal.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .collect(Collectors.toSet());
        boolean administrator = authorities.contains(ADMIN_ROLE);
        boolean canManageCourses = administrator || authorities.contains(COURSE_MANAGEMENT_PERMISSION);
        return ResponseEntity.ok(catalogService.getDetail(id, userId, canManageCourses, administrator));
    }

    private Long getUserId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}
