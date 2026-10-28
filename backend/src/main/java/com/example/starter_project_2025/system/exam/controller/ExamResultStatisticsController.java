package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import com.example.starter_project_2025.system.exam.service.ExamResultStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.starter_project_2025.system.exam.dto.ExamAttemptStatisticsDTO;
import com.example.starter_project_2025.system.exam.service.ExamAttemptStatisticsService;
import java.util.List;


@RestController
@RequestMapping("/api/exams/{examId}/result-statistics")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamResultStatisticsController {

    private final ExamResultStatisticsService statisticsService;
    private final ExamAttemptStatisticsService attemptStatisticsService;


    @GetMapping
    public ResponseEntity<ExamResultStatisticsDTO> getStatistics(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                statisticsService.getStatistics(examId)
        );
    }

    @GetMapping("/attempts")
    public ResponseEntity<List<ExamAttemptStatisticsDTO>> getAttemptStatistics(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                attemptStatisticsService.getAttempts(examId)
        );
    }

}
