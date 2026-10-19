package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.ExamTakerDTO;
import com.example.starter_project_2025.system.exam.service.ExamTakerService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
public class ExamTakerController {

    private final ExamTakerService service;

    @GetMapping("/{id}/take")
    @PreAuthorize("hasAuthority('EXAM_TAKE')")
    public ResponseEntity<ExamTakerDTO> take(@PathVariable Long id) {
        return ResponseEntity.ok(service.getForTaking(id));
    }
}