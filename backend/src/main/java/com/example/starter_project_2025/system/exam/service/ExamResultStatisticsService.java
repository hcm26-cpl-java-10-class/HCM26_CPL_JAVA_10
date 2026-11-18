package com.example.starter_project_2025.system.exam.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamResultStatisticsDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ExamResultStatisticsService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultReadinessService readinessService;
    private final ExamGradeScaleService gradeScaleService;

    public static BigDecimal resolvePassThreshold(Exam exam) {
        if (exam == null) {
            return BigDecimal.valueOf(5.00).setScale(2, RoundingMode.HALF_UP);
        }
        if (exam.getPassScore() != null) {
            return exam.getPassScore();
        }
        return ExamScoring.effectiveMax(exam.getMaxScore())
                .multiply(new BigDecimal("0.5"))
                .setScale(2, RoundingMode.HALF_UP);
    }

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

        // Tính phân phối theo khoảng % (PERCENTAGE) dựa trên cấu hình tùy chỉnh
        List<com.example.starter_project_2025.system.exam.dto.GradeScaleDTO> percentScales = gradeScaleService.getScales(examId, "PERCENTAGE");
        List<ExamResultStatisticsDTO.ScoreBandDTO> scoreDistribution = new ArrayList<>();

        for (var scale : percentScales) {
            long count = completedAttempts.stream()
                    .filter(attempt -> {
                        if (attempt.getFinalScore() == null) return false;
                        BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
                        if (maxScore.signum() <= 0) return false;
                        double pct = attempt.getFinalScore().doubleValue() * 100.0 / maxScore.doubleValue();
                        return pct >= scale.minScore().doubleValue() && pct <= scale.maxScore().doubleValue();
                    })
                    .count();

            scoreDistribution.add(new ExamResultStatisticsDTO.ScoreBandDTO(scale.gradeLetter(), count));
        }

        BigDecimal passThreshold = resolvePassThreshold(exam);

        long passedAttempts = 0L;
        long failedAttempts = 0L;
        Double passRate = 0.0;
        Double failRate = 0.0;

        if (!completedAttempts.isEmpty()) {
            passedAttempts = completedAttempts.stream()
                    .filter(a -> a.getFinalScore() != null && a.getFinalScore().compareTo(passThreshold) >= 0)
                    .count();
            failedAttempts = (long) completedAttempts.size() - passedAttempts;

            passRate = BigDecimal.valueOf(passedAttempts * 100.0 / completedAttempts.size())
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue();
            failRate = BigDecimal.valueOf(failedAttempts * 100.0 / completedAttempts.size())
                    .setScale(2, RoundingMode.HALF_UP)
                    .doubleValue();
        }

        // Tính phân phối theo Grade chữ (A, B, C, D, F)
        List<com.example.starter_project_2025.system.exam.dto.GradeScaleDTO> scales = gradeScaleService.getScales(examId, "GRADE");
        List<ExamResultStatisticsDTO.GradeDistributionDTO> gradeDistribution = new ArrayList<>();

        for (var scale : scales) {
            long count = completedAttempts.stream()
                    .filter(a -> {
                        if (a.getFinalScore() == null) return false;
                        BigDecimal score = a.getFinalScore();
                        return score.compareTo(scale.minScore()) >= 0 && score.compareTo(scale.maxScore()) <= 0;
                    })
                    .count();

            Double pct = completedAttempts.isEmpty() ? 0.0 :
                    BigDecimal.valueOf(count * 100.0 / completedAttempts.size())
                            .setScale(2, RoundingMode.HALF_UP)
                            .doubleValue();

            gradeDistribution.add(new ExamResultStatisticsDTO.GradeDistributionDTO(
                    scale.gradeLetter(),
                    scale.label(),
                    scale.minScore(),
                    scale.maxScore(),
                    scale.color(),
                    count,
                    pct
            ));
        }

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
                scoreDistribution,
                passedAttempts,
                passRate,
                failedAttempts,
                failRate,
                passThreshold,
                gradeDistribution
        );
    }
}
