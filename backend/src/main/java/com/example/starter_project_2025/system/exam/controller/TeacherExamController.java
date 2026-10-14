package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.service.TeacherExamService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/teacher/exams")
@RequiredArgsConstructor
public class TeacherExamController {

    private final TeacherExamService teacherExamService;

    @PostMapping
    @PreAuthorize("hasRole('TEACHER') or hasAuthority('EXAM_CREATE')")
    public ResponseEntity<ExamDTO> createExamForTeacher(
            @Validated(OnCreate.class) @RequestBody ExamDTO request) {
        ExamDTO created = teacherExamService.createForTeacher(request);
        return ResponseEntity.ok(created);
    }
}
