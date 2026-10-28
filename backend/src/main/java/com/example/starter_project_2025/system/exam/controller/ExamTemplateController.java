
package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.service.ExamTemplateService;
import com.example.starter_project_2025.system.exam.dto.ExamTemplateDTO;
import com.example.starter_project_2025.system.exam.dto.SaveExamTemplateRequest;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize; // CHANGED: phan quyen cho template
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
    @PreAuthorize("hasAuthority('EXAM_CREATE')") // CHANGED
    public ResponseEntity<ExamTemplateDTO> saveAsTemplate(
            @PathVariable Long examId,
            @Valid @RequestBody SaveExamTemplateRequest request
    ) {
        ExamTemplateDTO result =
                service.saveAsTemplate(examId, request);

        return ResponseEntity.ok(result);
    }

    /**
     * Lấy danh sách đề thi mẫu.
     */
    @GetMapping
    @PreAuthorize("hasAuthority('EXAM_UPDATE')") // CHANGED: STUDENT cung co EXAM_READ nen dung EXAM_UPDATE de chan sinh vien
    public ResponseEntity<List<ExamTemplateDTO>> listTemplates() {
        List<ExamTemplateDTO> templates = service.listTemplates();

        return ResponseEntity.ok(templates);
    }

    /**
     * Lấy chi tiết một đề thi mẫu.
     */
    @GetMapping("/{templateId}")
    @PreAuthorize("hasAuthority('EXAM_UPDATE')") // CHANGED: STUDENT cung co EXAM_READ nen dung EXAM_UPDATE de chan sinh vien
    public ResponseEntity<ExamTemplateDTO> getTemplate(
            @PathVariable Long templateId
    ) {
        ExamTemplateDTO template = service.getTemplate(templateId);

        return ResponseEntity.ok(template);
    }

    /**
     * Xóa đề thi mẫu.
     */
    @DeleteMapping("/{templateId}")
    @PreAuthorize("hasAuthority('EXAM_DELETE')") // CHANGED
    public ResponseEntity<Void> deleteTemplate(
            @PathVariable Long templateId
    ) {
        service.deleteTemplate(templateId);

        return ResponseEntity.noContent().build();
    }
}
