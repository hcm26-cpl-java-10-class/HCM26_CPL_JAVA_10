package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.PublishedExamScoreDTO;
import com.example.starter_project_2025.system.exam.service.PublishedExamScoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RestController
@RequestMapping("/api/exams/my-scores")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_TAKE')")
public class PublishedExamScoreController {

    private final PublishedExamScoreService scoreService;

    @GetMapping
    public ResponseEntity<List<PublishedExamScoreDTO>> getMyPublishedScores(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        if (principal == null || principal.getUser() == null
                || principal.getUser().getId() == null) {
            return ResponseEntity.status(401).build();
        }

        return ResponseEntity.ok(
                scoreService.findMyPublishedScores(principal.getUser().getId())
        );
    }
}
