package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.AdjustScoreRequest;
import com.example.starter_project_2025.system.exam.dto.ExamAttemptStatisticsDTO;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ExamAttemptStatisticsService {

    static final int MAX_REASON_LENGTH = 1000;

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamIntegrityEventRepository integrityEventRepository;
    private final ExamScoreAdjustmentRepository adjustmentRepository;

    public List<ExamAttemptStatisticsDTO> getAttempts(Long examId) {
        examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found"));

        Map<Long, Long> violations = new HashMap<>();
        for (ExamIntegrityEvent e : integrityEventRepository.findAllByExamIdOrderByOccurredAtAsc(examId)) {
            violations.merge(e.getAttemptId(), 1L, Long::sum);
        }

        return attemptRepository.findAllByExam_Id(examId)
                .stream()
                .sorted(
                        Comparator.comparing(
                                ExamAttempt::getStartedAt,
                                Comparator.nullsLast(Comparator.naturalOrder())
                        ).reversed()
                )
                .map(a -> toDTO(a, violations.getOrDefault(a.getId(), 0L)))
                .toList();
    }

    /** Ly do khong duoc sua; null neu duoc sua. Dung chung cho hien thi va kiem tra server. */
    static String lockReason(ExamAttempt attempt, long violationCount) {
        if (violationCount <= 0) {
            return "Chưa bị gắn cờ gian lận";
        }
        if (attempt.getStatus() != ExamAttemptStatus.SUBMITTED || attempt.getFinalScore() == null) {
            return "Bài chưa chấm xong";
        }
        return null;
    }

    @Transactional
    public ExamAttemptStatisticsDTO adjustScore(Long examId, Long attemptId, AdjustScoreRequest request, Long userId) {
        ExamAttempt attempt = attemptRepository.lockById(attemptId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam attempt not found"));
        if (!attempt.getExam().getId().equals(examId)) {
            throw new ResourceNotFoundException("Exam attempt not found");
        }

        long count = integrityEventRepository.countByAttemptId(attemptId);
        String locked = lockReason(attempt, count);
        if (locked != null) {
            throw new BadRequestException("Không thể sửa điểm: " + locked);
        }

        if (request == null || request.score() == null) {
            throw new BadRequestException("Vui lòng nhập điểm");
        }
        String reason = request.reason() == null ? "" : request.reason().trim();
        if (reason.isEmpty()) {
            throw new BadRequestException("Vui lòng nhập lý do sửa điểm");
        }
        if (reason.length() > MAX_REASON_LENGTH) {
            throw new BadRequestException("Lý do tối đa " + MAX_REASON_LENGTH + " ký tự");
        }

        BigDecimal score = request.score().setScale(4, RoundingMode.HALF_UP);
        if (score.signum() < 0) {
            throw new BadRequestException("Điểm không được âm");
        }
        BigDecimal max = attempt.getMaxScore();
        if (max != null && score.compareTo(max) > 0) {
            throw new BadRequestException("Điểm không được vượt quá điểm tối đa (" + max.stripTrailingZeros().toPlainString() + ")");
        }

        ExamScoreAdjustment log = new ExamScoreAdjustment();
        log.setAttemptId(attemptId);
        log.setExamId(examId);
        if (attempt.getFirstScore() == null) {
            attempt.setFirstScore(attempt.getFinalScore());
        }
        log.setOldScore(attempt.getFinalScore());
        log.setNewScore(score);
        log.setReason(reason);
        log.setAdjustedBy(userId);
        log.setAdjustedAt(Instant.now());
        adjustmentRepository.save(log);

        attempt.setFinalScore(score);
        attemptRepository.save(attempt);

        return toDTO(attempt, count);
    }

    private ExamAttemptStatisticsDTO toDTO(ExamAttempt attempt, long violationCount) {
        User student = attempt.getStudent();

        String studentName = "";
        String studentEmail = "";

        if (student != null) {
            String firstName = student.getFirstName() == null
                    ? "" : student.getFirstName().trim();

            String lastName = student.getLastName() == null
                    ? "" : student.getLastName().trim();

            studentName = (firstName + " " + lastName).trim();
            studentEmail = student.getEmail() == null
                    ? "" : student.getEmail();
        }

        String locked = lockReason(attempt, violationCount);

        return new ExamAttemptStatisticsDTO(
                attempt.getId(),
                student == null ? null : student.getId(),
                studentName,
                studentEmail,
                attempt.getAttemptNumber(),
                attempt.getStartedAt(),
                attempt.getSubmittedAt(),
                attempt.getFinalScore(),
                attempt.getStatus(),
                attempt.getMaxScore(),
                attempt.getFirstScore(),
                attempt.getFirstScore() == null ? null : attempt.getFinalScore(),
                violationCount > 0,
                violationCount,
                locked == null,
                locked
        );
    }
}
