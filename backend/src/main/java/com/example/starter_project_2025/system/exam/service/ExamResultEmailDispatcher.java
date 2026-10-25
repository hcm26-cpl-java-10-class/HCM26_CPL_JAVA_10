package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.dto.ScoreEmailRecipient;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class ExamResultEmailDispatcher {

    private final ExamAttemptRepository attemptRepository;
    private final ExamResultEmailService emailService;

    @Transactional(readOnly = true)
    public void dispatch(Exam exam) {
        if (exam == null || exam.getId() == null) {
            return;
        }

        List<ExamAttempt> attempts =
                attemptRepository.findAllByExam_Id(exam.getId());

        Map<Long, ExamAttempt> latestScoredAttempts = new LinkedHashMap<>();

        attempts.stream()
                .filter(attempt -> attempt.getStudent() != null)
                .filter(attempt -> attempt.getStudent().getId() != null)
                .filter(attempt -> attempt.getFinalScore() != null)
                .sorted(Comparator.comparingInt(ExamAttempt::getAttemptNumber))
                .forEach(attempt ->
                        latestScoredAttempts.put(
                                attempt.getStudent().getId(),
                                attempt
                        )
                );

        List<ScoreEmailRecipient> recipients =
                latestScoredAttempts.values().stream()
                        .filter(attempt ->
                                attempt.getStudent().getEmail() != null
                                        && !attempt.getStudent().getEmail().isBlank()
                        )
                        .map(attempt -> new ScoreEmailRecipient(
                                attempt.getStudent().getId(),
                                attempt.getStudent().getEmail(),
                                "Exam: " + exam.getTitle()
                                        + "\nAttempt: " + attempt.getAttemptNumber()
                                        + "\nObjective score: "
                                        + (attempt.getObjectiveScore() == null
                                        ? "Not available"
                                        : attempt.getObjectiveScore().setScale(2, java.math.RoundingMode.HALF_UP)) // CHANGED: hiển thị 2 số lẻ
                                        + "\nFinal score: "
                                        + attempt.getFinalScore().setScale(2, java.math.RoundingMode.HALF_UP)
                                        + "/" + ExamScoring.effectiveMax(attempt.getMaxScore()).stripTrailingZeros().toPlainString()
                        ))
                        .toList();

        emailService.sendScoreEmails(exam, recipients);
    }
}
