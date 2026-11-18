package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.service.ExamTemplateService;
import com.example.starter_project_2025.system.exam.dto.ExamTemplateDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.UpdateExamTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.CreateExamFromTemplateRequest;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exam-templates")
@RequiredArgsConstructor
public class ExamTemplateController {

    private final ExamTemplateService service;

    /**
     * Lưu đề thi hiện có thành đề thi mẫu.
     */
    @PostMapping("/from-exam/{examId}")
    @PreAuthorize("hasAuthority('EXAM_CREATE')")
    public ResponseEntity<ExamTemplateDTO> saveAsTemplate(
            @PathVariable Long examId,
            @Valid @RequestBody SaveExamTemplateRequest request
    ) {
        ExamTemplateDTO result = service.saveAsTemplate(examId, request);
        return ResponseEntity.ok(result);
    }

    /**
     * Lấy danh sách đề thi mẫu.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<List<ExamTemplateDTO>> listTemplates() {
        List<ExamTemplateDTO> templates = service.listTemplates();
        return ResponseEntity.ok(templates);
    }

    /**
     * Lấy chi tiết một đề thi mẫu.
     */
    @GetMapping("/{templateId}")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamTemplateDTO> getTemplate(
            @PathVariable Long templateId
    ) {
        ExamTemplateDTO template = service.getTemplate(templateId);
        return ResponseEntity.ok(template);
    }

    /**
     * Cập nhật thông tin đề thi mẫu (tên, mô tả, cấu hình thời gian).
     */
    @PutMapping("/{templateId}")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')")
    public ResponseEntity<ExamTemplateDTO> updateTemplate(
            @PathVariable Long templateId,
            @Valid @RequestBody UpdateExamTemplateRequest request
    ) {
        ExamTemplateDTO result = service.updateTemplate(templateId, request);
        return ResponseEntity.ok(result);
    }

    /**
     * Tạo bài thi mới từ đề thi mẫu.
     */
    @PostMapping("/{templateId}/create-exam")
    @PreAuthorize("hasAuthority('EXAM_CREATE')")
    public ResponseEntity<ExamDTO> createExamFromTemplate(
            @PathVariable Long templateId,
            @Valid @RequestBody CreateExamFromTemplateRequest request
    ) {
        ExamDTO result = service.createExamFromTemplate(templateId, request);
        return ResponseEntity.ok(result);
    }

    /**
     * Xóa đề thi mẫu.
     */
    @DeleteMapping("/{templateId}")
    @PreAuthorize("hasAuthority('EXAM_DELETE')")
    public ResponseEntity<Void> deleteTemplate(
            @PathVariable Long templateId
    ) {
        service.deleteTemplate(templateId);
        return ResponseEntity.noContent().build();
    }
}
