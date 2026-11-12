package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolConfigRequest;
import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolConfigResponse;
import com.example.starter_project_2025.system.exam.dto.ExamQuestionPoolVersionHistoryResponse;
import com.example.starter_project_2025.system.exam.service.ExamQuestionPoolVersionService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamQuestionPoolVersionController {

    private final ExamQuestionPoolVersionService poolVersionService;

    /**
     * Lấy cấu hình Question Pool hiện tại.
     */
    @GetMapping("/{examId}/question-pool")
    public ResponseEntity<ExamQuestionPoolConfigResponse> getCurrentConfig(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                poolVersionService.getCurrentConfig(examId)
        );
    }

    /**
     * Lưu cấu hình Question Pool và tạo Version mới.
     */
    @PutMapping("/{examId}/question-pool")
    public ResponseEntity<ExamQuestionPoolConfigResponse> saveConfig(
            @PathVariable Long examId,
            @RequestBody ExamQuestionPoolConfigRequest request
    ) {
        return ResponseEntity.ok(
                poolVersionService.saveConfig(examId, request)
        );
    }

    /**
     * Lấy lịch sử các Question Pool Version.
     */
    @GetMapping("/{examId}/question-pool/versions")
    public ResponseEntity<List<ExamQuestionPoolVersionHistoryResponse>> getVersionHistory(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                poolVersionService.getVersionHistory(examId)
        );
    }
}