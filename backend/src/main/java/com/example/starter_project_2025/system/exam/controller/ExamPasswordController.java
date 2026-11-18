package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamPasswordVerifyRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/exams")
public class ExamPasswordController {

    private final ExamRepository examRepository;

    public ExamPasswordController(ExamRepository examRepository) {
        this.examRepository = examRepository;
    }

    @PostMapping("/{id}/verify-password")
    @PreAuthorize("hasAuthority('EXAM_TAKE')")
    public ResponseEntity<Map<String, Object>> verifyPassword(
            @PathVariable Long id,
            @Valid @RequestBody ExamPasswordVerifyRequest request
    ) {
        Exam exam = examRepository.findById(id)
                .filter(e -> Boolean.TRUE.equals(e.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));

        if (exam.getAccessCode() == null || exam.getAccessCode().trim().isEmpty()) {
            return ResponseEntity.ok(Map.of("valid", true, "message", "Đề thi không yêu cầu mật khẩu"));
        }

        if (!exam.getAccessCode().trim().equals(request.getPassword().trim())) {
            throw new BadRequestException("Mật khẩu đề thi không chính xác");
        }

        return ResponseEntity.ok(Map.of("valid", true, "message", "Mật khẩu chính xác"));
    }
}
