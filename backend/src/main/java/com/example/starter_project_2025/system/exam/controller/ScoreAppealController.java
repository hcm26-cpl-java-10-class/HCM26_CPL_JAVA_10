package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealAdjustmentDTO;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealCreateRequest;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealDTO;
import com.example.starter_project_2025.system.exam.dto.ScoreAppealReviewRequest;
import com.example.starter_project_2025.system.exam.service.ScoreAppealService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@ResourceMenu(
        title = "My Appeals",
        group = "Exam",
        icon = "message",
        url = "/my-appeals",
        order = 4,
        permission = "SCORE_APPEAL_VIEW_OWN"
)
public class ScoreAppealController {

    private final ScoreAppealService scoreAppealService;

    @PostMapping("/attempts/{attemptId}/appeals")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_CREATE')")
    public ResponseEntity<ScoreAppealDTO> create(
            @PathVariable Long attemptId,
            @Valid @RequestBody ScoreAppealCreateRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        ScoreAppealDTO created = scoreAppealService.createAppeal(
                principal.getUser().getId(), attemptId, request.reason(), request.requestedScore());
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/appeals/my")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_CREATE') or hasAuthority('SCORE_APPEAL_VIEW_OWN')")
    public ResponseEntity<List<ScoreAppealDTO>> listMine(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(scoreAppealService.listMyAppeals(principal.getUser().getId()));
    }

    @GetMapping("/{examId}/appeals")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_REVIEW')")
    public ResponseEntity<List<ScoreAppealDTO>> listByExam(@PathVariable Long examId) {
        return ResponseEntity.ok(scoreAppealService.listByExam(examId));
    }

    @GetMapping("/appeals/{id}")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_REVIEW') or hasAuthority('SCORE_APPEAL_VIEW_OWN')")
    public ResponseEntity<ScoreAppealDTO> getById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(scoreAppealService.getById(id, principal));
    }

    @PostMapping("/appeals/{id}/review")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_REVIEW')")
    public ResponseEntity<ScoreAppealDTO> review(
            @PathVariable Long id,
            @Valid @RequestBody ScoreAppealReviewRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        ScoreAppealDTO reviewed = scoreAppealService.review(
                id, request.decision(), request.newScore(), request.resolutionNote(), principal);
        return ResponseEntity.ok(reviewed);
    }

    @GetMapping("/attempts/{attemptId}/appeal-history")
    @PreAuthorize("hasAuthority('SCORE_APPEAL_REVIEW')")
    public ResponseEntity<List<ScoreAppealAdjustmentDTO>> getHistory(@PathVariable Long attemptId) {
        return ResponseEntity.ok(scoreAppealService.getHistory(attemptId));
    }
}
