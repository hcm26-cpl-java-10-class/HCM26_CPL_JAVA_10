package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.AttemptPoint;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.ClassAverage;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.TypeAccuracy;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.util.*;

@Service
@RequiredArgsConstructor
public class MyScoreInsightsService {

    /** Class averages are hidden below this number of participants so nobody can read another student's score. */
    static final int MIN_PARTICIPANTS_FOR_AVERAGE = 3;

    private final ExamAttemptRepository attemptRepository;
    private final ScoreAppealRepository appealRepository;
    private final ExamResultAccessService resultAccessService;

    @Transactional(readOnly = true)
    public MyScoreInsightsDTO getInsights(Long studentId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student ID is required");
        }

        List<ExamAttempt> mine = attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId).stream()
                .filter(a -> a.getExam() != null && a.getExam().getId() != null && a.getSubmittedAt() != null)
                .toList();

        Map<Long, Boolean> publishedByExam = new HashMap<>();
        for (ExamAttempt a : mine) {
            publishedByExam.computeIfAbsent(a.getExam().getId(),
                    id -> resultAccessService.isResultPublished(a.getExam()));
        }

        int awaiting = (int) mine.stream()
                .map(a -> a.getExam().getId())
                .filter(id -> !publishedByExam.get(id))
                .distinct()
                .count();

        List<ExamAttempt> published = mine.stream()
                .filter(a -> publishedByExam.get(a.getExam().getId()) && a.getFinalScore() != null)
                .sorted(Comparator.comparing(ExamAttempt::getSubmittedAt))
                .toList();

        List<AttemptPoint> points = published.stream().map(this::toPoint).toList();

        int pendingAppeals = (int) appealRepository.findByStudent_IdOrderByCreatedAtDesc(studentId).stream()
                .filter(ap -> ap.getStatus() == ScoreAppealStatus.PENDING)
                .count();

        return new MyScoreInsightsDTO(
                points,
                classAverages(published),
                awaiting,
                pendingAppeals,
                accuracyByType(published)
        );
    }

    private AttemptPoint toPoint(ExamAttempt a) {
        long seconds = a.getStartedAt() == null ? 0
                : Math.max(0, Duration.between(a.getStartedAt(), a.getSubmittedAt()).getSeconds());
        seconds = Math.min(seconds, a.getDurationMinutes() * 60L);
        return new AttemptPoint(
                a.getExam().getId(),
                a.getExam().getTitle(),
                a.getAttemptNumber(),
                a.getFinalScore(),
                ExamScoring.effectiveMax(a.getMaxScore()),
                ExamScoring.passed(a),
                a.getStartedAt(),
                a.getSubmittedAt(),
                a.getDurationMinutes(),
                seconds
        );
    }

    private List<ClassAverage> classAverages(List<ExamAttempt> published) {
        List<ClassAverage> result = new ArrayList<>();
        for (Long examId : published.stream().map(a -> a.getExam().getId()).distinct().toList()) {
            Map<Long, BigDecimal> bestPercentByStudent = new HashMap<>();
            for (ExamAttempt a : attemptRepository.findAllByExam_Id(examId)) {
                if (a.getStudent() == null || a.getFinalScore() == null || a.getSubmittedAt() == null) {
                    continue;
                }
                BigDecimal pct = a.getFinalScore().multiply(BigDecimal.valueOf(100))
                        .divide(ExamScoring.effectiveMax(a.getMaxScore()), 2, RoundingMode.HALF_UP);
                bestPercentByStudent.merge(a.getStudent().getId(), pct, BigDecimal::max);
            }
            int n = bestPercentByStudent.size();
            if (n < MIN_PARTICIPANTS_FOR_AVERAGE) {
                continue;
            }
            BigDecimal sum = bestPercentByStudent.values().stream().reduce(BigDecimal.ZERO, BigDecimal::add);
            result.add(new ClassAverage(examId, sum.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP), n));
        }
        return result;
    }

    private List<TypeAccuracy> accuracyByType(List<ExamAttempt> published) {
        Map<QuestionType, BigDecimal[]> acc = new EnumMap<>(QuestionType.class);
        Map<QuestionType, Integer> counts = new EnumMap<>(QuestionType.class);

        for (ExamAttempt a : published) {
            long totalWeight = a.getQuestions().stream().mapToLong(ExamAttemptQuestion::getPoints).sum();
            if (totalWeight <= 0) {
                continue;
            }
            BigDecimal max = ExamScoring.effectiveMax(a.getMaxScore());
            Map<Long, BigDecimal> scoreByQuestion = new HashMap<>();
            for (ExamAttemptAnswer ans : a.getAnswers()) {
                if (ans.getQuestion() != null && ans.getScore() != null) {
                    scoreByQuestion.merge(ans.getQuestion().getId(), ans.getScore(), BigDecimal::add);
                }
            }
            for (ExamAttemptQuestion q : a.getQuestions()) {
                if (q.getType() == null) {
                    continue;
                }
                BigDecimal possible = ExamScoring.share(max, (long) q.getPoints(), totalWeight);
                BigDecimal earned = scoreByQuestion.getOrDefault(q.getId(), BigDecimal.ZERO);
                BigDecimal[] pair = acc.computeIfAbsent(q.getType(), t -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                pair[0] = pair[0].add(earned.min(possible));
                pair[1] = pair[1].add(possible);
                counts.merge(q.getType(), 1, Integer::sum);
            }
        }

        List<TypeAccuracy> out = new ArrayList<>();
        acc.forEach((type, pair) -> {
            if (pair[1].signum() <= 0) {
                return;
            }
            out.add(new TypeAccuracy(
                    type,
                    counts.get(type),
                    pair[0].setScale(2, RoundingMode.HALF_UP),
                    pair[1].setScale(2, RoundingMode.HALF_UP),
                    pair[0].multiply(BigDecimal.valueOf(100)).divide(pair[1], 1, RoundingMode.HALF_UP)
            ));
        });
        return out;
    }
}
