package com.example.starter_project_2025.system.exam.controller;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.exam.dto.AdjustScoreRequest;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptStatisticsDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO;
import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import com.example.starter_project_2025.system.exam.service.ExamItemAnalysisService;
import com.example.starter_project_2025.system.exam.service.ExamAttemptStatisticsService;
import com.example.starter_project_2025.system.exam.service.ExamResultStatisticsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;


@RestController
@RequestMapping("/api/exams/{examId}/result-statistics")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamResultStatisticsController {

    private final ExamResultStatisticsService statisticsService;
    private final ExamAttemptStatisticsService attemptStatisticsService;
    private final ExamItemAnalysisService itemAnalysisService;


    @GetMapping
    public ResponseEntity<ExamResultStatisticsDTO> getStatistics(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                statisticsService.getStatistics(examId)
        );
    }

    /** EXM-013: ty le hoan thanh + item analysis (do kho, do phan biet, phan tich dap an). */
    @GetMapping("/item-analysis")
    public ResponseEntity<ExamItemAnalysisDTO> getItemAnalysis(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(itemAnalysisService.analyze(examId));
    }

    @GetMapping("/attempts")
    public ResponseEntity<List<ExamAttemptStatisticsDTO>> getAttemptStatistics(
            @PathVariable Long examId
    ) {
        return ResponseEntity.ok(
                attemptStatisticsService.getAttempts(examId)
        );
    }

    /** Sua diem cuoi cua 1 luot thi - chi luot bi gan co gian lan va da cham xong. */
    @PutMapping("/attempts/{attemptId}/score")
    public ResponseEntity<ExamAttemptStatisticsDTO> adjustScore(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @RequestBody AdjustScoreRequest request,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        return ResponseEntity.ok(
                attemptStatisticsService.adjustScore(examId, attemptId, request, principal.getUser().getId())
        );
    }

}
