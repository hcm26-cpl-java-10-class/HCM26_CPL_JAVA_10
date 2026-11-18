package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.GradeScaleDTO;
import com.example.starter_project_2025.system.exam.service.ExamGradeScaleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams/{examId}/grade-scales")
@RequiredArgsConstructor
@Tag(name = "Exam Grade Scale", description = "Quản lý cấu hình khoảng điểm chữ (A, B, C...) hoặc khoảng % (PERCENTAGE)")
public class ExamGradeScaleController {

    private final ExamGradeScaleService gradeScaleService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')")
    @Operation(summary = "Lấy danh sách khoảng điểm (type=GRADE hoặc type=PERCENTAGE)")
    public ResponseEntity<List<GradeScaleDTO>> getGradeScales(
            @PathVariable Long examId,
            @RequestParam(required = false, defaultValue = "GRADE") String type
    ) {
        return ResponseEntity.ok(gradeScaleService.getScales(examId, type));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "Cập nhật danh sách khoảng điểm (type=GRADE hoặc type=PERCENTAGE)")
    public ResponseEntity<List<GradeScaleDTO>> saveGradeScales(
            @PathVariable Long examId,
            @RequestParam(required = false, defaultValue = "GRADE") String type,
            @RequestBody List<GradeScaleDTO> dtoList
    ) {
        return ResponseEntity.ok(gradeScaleService.saveScales(examId, type, dtoList));
    }

    @DeleteMapping("/reset")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    @Operation(summary = "Khôi phục thang điểm về mặc định (type=GRADE hoặc type=PERCENTAGE)")
    public ResponseEntity<Void> resetGradeScales(
            @PathVariable Long examId,
            @RequestParam(required = false, defaultValue = "GRADE") String type
    ) {
        gradeScaleService.resetToDefault(examId, type);
        return ResponseEntity.noContent().build();
    }
}
