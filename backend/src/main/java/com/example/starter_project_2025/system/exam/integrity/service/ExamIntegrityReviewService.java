package com.example.starter_project_2025.system.exam.integrity.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamAttemptIntegrityReview;
import com.example.starter_project_2025.system.exam.integrity.domain.ExamAttemptIntegrityReviewRepository;
import com.example.starter_project_2025.system.exam.integrity.domain.IntegrityReviewStatus;
import com.example.starter_project_2025.system.exam.integrity.dto.ExamIntegrityReportDTO;
import com.example.starter_project_2025.system.exam.integrity.dto.IntegrityReviewRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamIntegrityReviewService {

    private final ExamAttemptRepository attemptRepository;
    private final ExamAttemptIntegrityReviewRepository reviewRepository;

    @Transactional(readOnly = true)
    public ExamIntegrityReportDTO enrichReport(ExamIntegrityReportDTO report) {
        if (report == null || report.getExamId() == null || report.getRows() == null) {
            return report;
        }
        Map<Long, ExamAttemptIntegrityReview> reviewsByAttempt = reviewRepository.findAllByExamId(report.getExamId())
                .stream()
                .collect(Collectors.toMap(ExamAttemptIntegrityReview::getAttemptId, Function.identity(), (a, b) -> b));

        for (ExamIntegrityReportDTO.Row row : report.getRows()) {
            ExamAttemptIntegrityReview review = reviewsByAttempt.get(row.getAttemptId());
            if (review != null) {
                row.setReviewStatus(review.getReviewStatus());
                row.setReviewNote(review.getReviewNote());
                row.setReviewedBy(review.getReviewedBy());
                row.setReviewedAt(review.getReviewedAt());
            } else {
                row.setReviewStatus(IntegrityReviewStatus.UNREVIEWED);
            }
        }
        return report;
    }

    @Transactional
    public ExamAttemptIntegrityReview submitReview(
            Long examId,
            Long attemptId,
            IntegrityReviewRequest request,
            Long reviewerId
    ) {
        ExamAttempt attempt = attemptRepository.findById(attemptId)
                .filter(a -> a.getExam() != null && examId.equals(a.getExam().getId()))
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));

        if (request == null || request.status() == null) {
            throw new BadRequestException("Review status is required");
        }
        String note = request.note() == null ? null : request.note().trim();
        if (request.status() == IntegrityReviewStatus.CONFIRMED_VIOLATION
                && (note == null || note.isEmpty())) {
            throw new BadRequestException("A review note is required when confirming an integrity violation");
        }

        ExamAttemptIntegrityReview review = reviewRepository.findByAttemptId(attempt.getId())
                .orElseGet(() -> ExamAttemptIntegrityReview.builder()
                        .examId(examId)
                        .attemptId(attempt.getId())
                        .build());

        review.setReviewStatus(request.status());
        review.setReviewNote(note);
        review.setReviewedBy(reviewerId);
        review.setReviewedAt(Instant.now());

        return reviewRepository.save(review);
    }
}
