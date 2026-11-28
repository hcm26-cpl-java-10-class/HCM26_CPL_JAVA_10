package com.example.starter_project_2025.system.demo.learningpath;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.learningpath.LearningPathDTO.*;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/learning-paths")
@Tag(name = "Learning Paths", description = "Ordered groups of courses with derived progress")
public class LearningPathController {

    private final LearningPathService service;

    @GetMapping
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public List<PathSummary> list(@AuthenticationPrincipal UserPrincipal principal) {
        return service.list(userId(principal));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_READ')")
    public PathDetail get(@AuthenticationPrincipal UserPrincipal principal, @PathVariable Long id) {
        return service.get(id, userId(principal));
    }

    @PostMapping
    @PreAuthorize("hasAuthority('COURSE_CREATE')")
    public ResponseEntity<PathSummary> create(@Valid @RequestBody PathRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public ResponseEntity<Void> update(@PathVariable Long id, @Valid @RequestBody PathRequest request) {
        service.update(id, request);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/courses")
    @PreAuthorize("hasAuthority('COURSE_UPDATE')")
    public ResponseEntity<Void> setCourses(@PathVariable Long id, @Valid @RequestBody SetCoursesRequest request) {
        service.setCourses(id, request.courseIds());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('COURSE_DELETE')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    private Long userId(UserPrincipal principal) {
        if (principal == null || principal.getUser() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
        return principal.getUser().getId();
    }
}
