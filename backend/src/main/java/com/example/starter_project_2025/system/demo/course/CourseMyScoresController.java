package com.example.starter_project_2025.system.demo.course;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses")
public class CourseMyScoresController {

    private final CourseMyScoresService courseMyScoresService;

    @GetMapping("/my-scores")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<List<CourseMyScoresDTO>> getMyCourseScores(
            @AuthenticationPrincipal(expression = "user.id") Long studentId
    ) {
        if (studentId == null) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(
                courseMyScoresService.findMyCourseScores(studentId)
        );
    }
}
