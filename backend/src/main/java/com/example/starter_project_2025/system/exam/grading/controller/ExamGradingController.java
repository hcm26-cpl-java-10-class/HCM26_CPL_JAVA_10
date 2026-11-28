package com.example.starter_project_2025.system.exam.grading.controller;

import com.example.starter_project_2025.system.exam.grading.dto.EssayGradingDTO;
import com.example.starter_project_2025.system.exam.grading.dto.ReturnForRevisionRequest;
import com.example.starter_project_2025.system.exam.integrity.dto.ExamSimilarityDTO;
import com.example.starter_project_2025.system.exam.grading.service.BatchAiEssayGradingService;
import com.example.starter_project_2025.system.exam.grading.service.ExamEssayGradingService;
import com.example.starter_project_2025.system.exam.integrity.service.ExamSimilarityService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/exams/{examId}/grading")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('EXAM_UPDATE')")
public class ExamGradingController {

    private final ExamEssayGradingService service;
    private final BatchAiEssayGradingService batchAiService;
    private final ExamSimilarityService similarityService;

    @GetMapping("/attempts")
    public ResponseEntity<List<EssayGradingDTO.Summary>> listPending(@PathVariable Long examId) {
        return ResponseEntity.ok(service.listPending(examId));
    }

    @GetMapping("/attempts/{attemptId}")
    public ResponseEntity<EssayGradingDTO.Detail> getDetail(
            @PathVariable Long examId,
            @PathVariable Long attemptId
    ) {
        return ResponseEntity.ok(service.getDetail(examId, attemptId));
    }

    @PostMapping("/attempts/{attemptId}/grade")
    public ResponseEntity<EssayGradingDTO.Detail> submitOfficialGrade(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @RequestBody EssayGradingDTO.GradeSubmissionRequest request
    ) {
        return ResponseEntity.ok(service.submitOfficialGrade(examId, attemptId, request));
    }

    /** Tra bai yeu cau sinh vien sua va nop lai (UFR-EXM-011). */
    @PostMapping("/attempts/{attemptId}/return-for-revision")
    public ResponseEntity<EssayGradingDTO.Detail> returnForRevision(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @Valid @RequestBody ReturnForRevisionRequest request
    ) {
        return ResponseEntity.ok(service.returnForRevision(examId, attemptId, request));
    }

    /** Lay Reference Answer va Rubric da submit cho mot cau hoi trong de thi. */
    @GetMapping("/questions/{questionId}/guidelines")
    public ResponseEntity<EssayGradingDTO.QuestionGuidelineDTO> getQuestionGuidelines(
            @PathVariable Long examId,
            @PathVariable Long questionId
    ) {
        return ResponseEntity.ok(service.getQuestionGuidelines(examId, questionId));
    }

    /** Submit Reference Answer (Model Answer) cho cau hoi trong de thi. */
    @PutMapping("/questions/{questionId}/reference")
    public ResponseEntity<EssayGradingDTO.QuestionGuidelineDTO> submitReferenceAnswer(
            @PathVariable Long examId,
            @PathVariable Long questionId,
            @RequestBody(required = false) EssayGradingDTO.SubmitReferenceRequest request
    ) {
        return ResponseEntity.ok(service.submitReferenceAnswer(
                examId,
                questionId,
                request != null ? request.getReferenceAnswer() : ""
        ));
    }

    /** Submit Grading Rubric & Criteria cho cau hoi trong de thi. */
    @PutMapping("/questions/{questionId}/rubric")
    public ResponseEntity<EssayGradingDTO.QuestionGuidelineDTO> submitRubric(
            @PathVariable Long examId,
            @PathVariable Long questionId,
            @RequestBody(required = false) EssayGradingDTO.SubmitRubricRequest request
    ) {
        return ResponseEntity.ok(service.submitRubric(
                examId,
                questionId,
                request != null ? request.getRubric() : ""
        ));
    }

    /** Chay thu toan bo test cua mot cau lap trinh tren code sinh vien (khong luu gi). */
    @PostMapping("/attempts/{attemptId}/coding/{questionId}/run")
    public ResponseEntity<EssayGradingDTO.CodingRunResult> runCoding(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @PathVariable Long questionId
    ) {
        return ResponseEntity.ok(service.runCodingTests(examId, attemptId, questionId));
    }

    /** Cham lai cau lap trinh bang may cham va luu diem. */
    @PostMapping("/attempts/{attemptId}/coding/{questionId}/regrade")
    public ResponseEntity<EssayGradingDTO.Detail> regradeCoding(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @PathVariable Long questionId
    ) {
        return ResponseEntity.ok(service.regradeCoding(examId, attemptId, questionId));
    }

    @PostMapping("/attempts/{attemptId}/ai-suggest")
    public ResponseEntity<EssayGradingDTO.AiGradingResponse> requestAiGrading(
            @PathVariable Long examId,
            @PathVariable Long attemptId,
            @RequestBody(required = false) EssayGradingDTO.AiGradingRequest request
    ) {
        return ResponseEntity.ok(service.requestAiGrading(examId, attemptId, request));
    }

    @GetMapping("/similarity")
    public ResponseEntity<ExamSimilarityDTO.SimilarityReport> getSimilarityReport(@PathVariable Long examId) {
        return ResponseEntity.ok(similarityService.scanExamSimilarity(examId));
    }

    @PostMapping("/similarity/scan")
    public ResponseEntity<ExamSimilarityDTO.SimilarityReport> triggerSimilarityScan(@PathVariable Long examId) {
        return ResponseEntity.ok(similarityService.scanExamSimilarity(examId));
    }

    /** Xem thong tin thong ke truoc khi khoi chay AI cham hang loat. */
    @GetMapping("/batch-ai/preview")
    public ResponseEntity<EssayGradingDTO.BatchPreviewDTO> previewBatchAi(@PathVariable Long examId) {
        return ResponseEntity.ok(batchAiService.previewBatch(examId));
    }

    /** Khoi chay AI cham hang loat (asynchronous background batch). */
    @PostMapping("/batch-ai/start")
    public ResponseEntity<EssayGradingDTO.BatchStatusDTO> startBatchAi(
            @PathVariable Long examId,
            @RequestBody(required = false) EssayGradingDTO.StartBatchRequest request
    ) {
        return ResponseEntity.ok(batchAiService.startBatch(examId, request));
    }

    /** Lay trang thai batch AI moi nhat cua ky thi. */
    @GetMapping("/batch-ai/latest")
    public ResponseEntity<EssayGradingDTO.BatchStatusDTO> getLatestBatchAiStatus(@PathVariable Long examId) {
        EssayGradingDTO.BatchStatusDTO latest = batchAiService.getLatestBatchStatus(examId);
        return ResponseEntity.ok(latest);
    }

    /** Lay trang thai chi tiet cua mot batch AI theo batchId. */
    @GetMapping("/batch-ai/{batchId}")
    public ResponseEntity<EssayGradingDTO.BatchStatusDTO> getBatchAiStatus(
            @PathVariable Long examId,
            @PathVariable Long batchId
    ) {
        return ResponseEntity.ok(batchAiService.getBatchStatus(examId, batchId));
    }

    /** Danh sach bai thi cho giao vien kiem tra va xac nhan ket qua AI cham (co phan trang va bo loc). */
    @GetMapping("/ai-review-queue")
    public ResponseEntity<Page<EssayGradingDTO.Summary>> listAiReviewQueue(
            @PathVariable Long examId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        return ResponseEntity.ok(batchAiService.listReviewQueue(
                examId,
                state,
                search,
                PageRequest.of(safePage, safeSize)
        ));
    }

    /** Xac nhan hang loat tat ca cac bai AI da cham dat yeu cau (yeu cau confirmationText = 'APPLY ALL', giu lai bai diem thap/fail de GV check tay). */
    @PostMapping("/batch-ai/confirm-all")
    public ResponseEntity<EssayGradingDTO.BulkConfirmResultDTO> bulkConfirmAiGrades(
            @PathVariable Long examId,
            @RequestBody EssayGradingDTO.BulkConfirmRequest request
    ) {
        return ResponseEntity.ok(batchAiService.bulkConfirmAiGrades(examId, request));
    }
}
