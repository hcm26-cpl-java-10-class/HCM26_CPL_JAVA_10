package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamResultStatisticsService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultReadinessService readinessService;

    @Transactional(readOnly = true)
    public ExamResultStatisticsDTO getStatistics(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() ->
                        new ResourceNotFoundException("Exam not found")
                );

        List<ExamAttempt> attempts =
                attemptRepository.findAllByExam_Id(examId);

        List<ExamAttempt> completedAttempts = attempts.stream()
                .filter(readinessService::isFullyGraded)
                .toList();

        List<BigDecimal> scores = completedAttempts.stream()
                .map(ExamAttempt::getFinalScore)
                .filter(Objects::nonNull)
                .toList();

        Set<Long> studentIds = attempts.stream()
                .map(attempt -> attempt.getStudent() == null
                        ? null
                        : attempt.getStudent().getId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Double averageScore = scores.isEmpty()
                ? null
                : scores.stream()
                .mapToDouble(BigDecimal::doubleValue)
                .average()
                .orElse(0.0);

        BigDecimal highestScore = scores.stream()
                .max(BigDecimal::compareTo)
                .orElse(null);

        BigDecimal lowestScore = scores.stream()
                .min(BigDecimal::compareTo)
                .orElse(null);

        Map<String, Long> distribution = new LinkedHashMap<>();
        distribution.put("0-49%", 0L);
        distribution.put("50-59%", 0L);
        distribution.put("60-69%", 0L);
        distribution.put("70-79%", 0L);
        distribution.put("80-89%", 0L);
        distribution.put("90%+", 0L);
        distribution.put("N/A", 0L);

        for (ExamAttempt attempt : completedAttempts) {
            BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());

            if (maxScore.signum() <= 0) {
                distribution.merge("N/A", 1L, Long::sum);
                continue;
            }

            double percentage =
                    attempt.getFinalScore().doubleValue() * 100.0 / maxScore.doubleValue();

            String range;

            if (percentage < 50) {
                range = "0-49%";
            } else if (percentage < 60) {
                range = "50-59%";
            } else if (percentage < 70) {
                range = "60-69%";
            } else if (percentage < 80) {
                range = "70-79%";
            } else if (percentage < 90) {
                range = "80-89%";
            } else {
                range = "90%+";
            }

            distribution.merge(range, 1L, Long::sum);
        }

        List<ExamResultStatisticsDTO.ScoreBandDTO> scoreDistribution =
                new ArrayList<>();

        distribution.forEach((range, count) ->
                scoreDistribution.add(
                        new ExamResultStatisticsDTO.ScoreBandDTO(
                                range, count
                        )
                )
        );

        return new ExamResultStatisticsDTO(
                exam.getId(),
                exam.getTitle(),
                attempts.size(),
                completedAttempts.size(),
                attempts.size() - completedAttempts.size(),
                studentIds.size(),
                averageScore,
                highestScore,
                lowestScore,
                scoreDistribution
        );
    }
}
