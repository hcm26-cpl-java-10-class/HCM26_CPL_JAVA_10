package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamResultReadinessService {

    private final ExamAttemptRepository attemptRepository;

    public boolean isFullyGraded(ExamAttempt attempt) {
        if (attempt == null
                || attempt.getFinalScore() == null
                || attempt.getSubmittedAt() == null) {
            return false;
        }

        ExamAttemptStatus status = attempt.getStatus();

        return status == ExamAttemptStatus.SUBMITTED
                || status == ExamAttemptStatus.EXPIRED;
    }

    @Transactional(readOnly = true)
    public void assertReadyToPublish(Long examId) {
        List<ExamAttempt> attempts =
                attemptRepository.findAllByExam_Id(examId);

        if (attempts.isEmpty()) {
            throw new BadRequestException(
                    "Cannot publish results because this exam has no attempts."
            );
        }

        long pendingCount = attempts.stream()
                .filter(attempt -> !isFullyGraded(attempt))
                .count();

        if (pendingCount > 0) {
            throw new BadRequestException(
                    "Cannot publish results: "
                            + pendingCount
                            + " of "
                            + attempts.size()
                            + " attempts are not fully graded."
            );
        }
    }
}
