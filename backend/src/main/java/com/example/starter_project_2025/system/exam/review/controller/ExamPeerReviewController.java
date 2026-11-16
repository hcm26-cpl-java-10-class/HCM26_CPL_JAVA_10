package com.example.starter_project_2025.system.exam.review.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignmentDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewAssignResultDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewFeedbackDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewProgressDTO;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewSubmitRequest;
import com.example.starter_project_2025.system.exam.review.dto.ExamReviewTargetDTO;
import com.example.starter_project_2025.system.exam.review.service.ExamPeerReviewService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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

/**
 * API cho workflow tu danh gia / danh gia cheo (UFR-EXM-012) - pham vi chi module Exam.
 */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamPeerReviewController {

    private final ExamPeerReviewService peerReviewService;

    /** Danh sach viec cham duoc gan cho nguoi dung hien tai. */
    @GetMapping("/reviews/my")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_READ')")
    public ResponseEntity<List<ExamReviewAssignmentDTO>> listMyAssignments(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(peerReviewService.listMyAssignments(principal.getUser().getId()));
    }

    /** Chi tiet bai lam duoc cham (tac gia bi an danh neu de thi bat an danh). */
    @GetMapping("/reviews/my/{assignmentId}")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_READ')")
    public ResponseEntity<ExamReviewTargetDTO> getTarget(
            @PathVariable Long assignmentId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(peerReviewService.getTarget(assignmentId, principal.getUser().getId()));
    }

    /** Nop phieu cham (chi nop duoc 1 lan). */
    @PostMapping("/reviews/{assignmentId}/submit")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_CREATE')")
    public ResponseEntity<ExamReviewFeedbackDTO> submitReview(
            @PathVariable Long assignmentId,
            @Valid @RequestBody ExamReviewSubmitRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                peerReviewService.submitReview(assignmentId, principal.getUser().getId(), request));
    }

    /** Feedback nhan duoc cho mot bai lam cua chinh minh (chi khi da cong bo ket qua). */
    @GetMapping("/attempts/{attemptId}/reviews")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_READ')")
    public ResponseEntity<List<ExamReviewFeedbackDTO>> listFeedback(
            @PathVariable Long attemptId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(
                peerReviewService.listFeedbackForAttempt(attemptId, principal.getUser().getId()));
    }

    /** Feedback nhan duoc cho tat ca bai lam cua chinh minh (chi khi da cong bo ket qua). */
    @GetMapping("/reviews/my-feedback")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_READ')")
    public ResponseEntity<List<ExamReviewFeedbackDTO>> listAllFeedback(
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(peerReviewService.listAllMyFeedback(principal.getUser().getId()));
    }

    /** Giao vien / admin phan cong reviewer cho cac bai lam da nop. */
    @PostMapping("/{examId}/reviews/assign")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_ASSIGN')")
    public ResponseEntity<ExamReviewAssignResultDTO> assign(
            @PathVariable Long examId,
            @AuthenticationPrincipal UserPrincipal principal) {
        return ResponseEntity.ok(peerReviewService.assignReviewers(examId, principal));
    }

    /** Giao vien / admin xem tien do phan cong va cham. */
    @GetMapping("/{examId}/reviews/overview")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_VIEW_ALL')")
    public ResponseEntity<ExamReviewAssignResultDTO> getOverview(@PathVariable Long examId) {
        return ResponseEntity.ok(peerReviewService.getAssignOverview(examId));
    }

    /** Giao vien / admin xem bang tien do tung phan cong. */
    @GetMapping("/{examId}/reviews/progress")
    @PreAuthorize("hasAuthority('EXAM_REVIEW_VIEW_ALL')")
    public ResponseEntity<List<ExamReviewProgressDTO>> listProgress(@PathVariable Long examId) {
        return ResponseEntity.ok(peerReviewService.listProgress(examId));
    }
}
