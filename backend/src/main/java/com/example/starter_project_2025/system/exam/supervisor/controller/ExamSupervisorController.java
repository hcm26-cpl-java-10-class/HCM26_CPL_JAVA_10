
package com.example.starter_project_2025.system.exam.supervisor.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.supervisor.dto.SupervisorAttemptDTO;
import com.example.starter_project_2025.system.exam.supervisor.dto.SupervisorViolationDTO;
import com.example.starter_project_2025.system.exam.supervisor.service.ExamSupervisorService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam-supervisor")
@RequiredArgsConstructor
public class ExamSupervisorController {

    private final ExamSupervisorService service;

    // Lấy danh sách học sinh đang thi
    @GetMapping("/attempts")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<List<SupervisorAttemptDTO>> getActiveAttempts(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
                service.getActiveAttempts(principal)
        );
    }

    // Lấy danh sách vi phạm của các lượt thi đang hoạt động
    @GetMapping("/violations")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ResponseEntity<List<SupervisorViolationDTO>> getActiveViolations(
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
                service.getActiveViolations(principal)
        );
    }
}
