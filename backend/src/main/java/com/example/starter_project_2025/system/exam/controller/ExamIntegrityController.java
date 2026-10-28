package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.ExamIntegrityReportDTO;
import com.example.starter_project_2025.system.exam.dto.IntegrityEventRequest;
import com.example.starter_project_2025.system.exam.dto.IntegrityReviewRequest;
import com.example.starter_project_2025.system.exam.service.AnonymousExamService;
import com.example.starter_project_2025.system.exam.service.ExamIntegrityService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** NEW (anti-cheat) */
@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamIntegrityController {

    private final ExamIntegrityService service;
    private final AnonymousExamService anonymousExamService;

    /** Sinh vien co tai khoan gui su kien / heartbeat. */
    @PostMapping("/attempts/{attemptId}/integrity-events")
    @PreAuthorize("hasAuthority('EXAM_TAKE')")
    public ResponseEntity<Void> record(
            @PathVariable Long attemptId,
            @Valid @RequestBody IntegrityEventRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest http
    ) {
        service.record(attemptId, principal.getUser().getId(), request,
                http.getHeader("User-Agent"), clientIp(http));
        return ResponseEntity.noContent().build();
    }

    /** Thi an danh (guest). */
    @PostMapping("/anonymous/attempts/{attemptId}/integrity-events")
    public ResponseEntity<Void> recordAnonymous(
            @PathVariable Long attemptId,
            @RequestHeader("X-Anonymous-Session") String sessionToken,
            @Valid @RequestBody IntegrityEventRequest request,
            HttpServletRequest http
    ) {
        anonymousExamService.recordIntegrity(sessionToken, attemptId, request,
                http.getHeader("User-Agent"), clientIp(http));
        return ResponseEntity.noContent().build();
    }

    /** Giao vien xem bao cao vi pham (hien trong trang Thong ke). */
    @GetMapping("/{examId}/integrity-report")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamIntegrityReportDTO> report(@PathVariable Long examId) {
        return ResponseEntity.ok(service.getReport(examId));
    }

    @GetMapping("/{examId}/integrity-report/attempts/{attemptId}/events")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<List<ExamIntegrityReportDTO.EventDTO>> events(
            @PathVariable Long examId, @PathVariable Long attemptId) {
        return ResponseEntity.ok(service.getEvents(examId, attemptId));
    }

    /** NEW: giao vien danh dau da xem xet 1 luot thi (binh thuong / nghi van) + ghi chu. */
    @PutMapping("/{examId}/integrity-report/attempts/{attemptId}/review")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<Void> review(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @Valid @RequestBody IntegrityReviewRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        service.review(examId, attemptId, request,
                principal.getUser().getId(), principal.getUser().getFullName());
        return ResponseEntity.noContent().build();
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        return req.getRemoteAddr();
    }
}
