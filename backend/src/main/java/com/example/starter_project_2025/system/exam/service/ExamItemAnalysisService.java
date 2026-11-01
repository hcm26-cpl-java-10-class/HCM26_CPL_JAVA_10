package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptOption;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.CompletionDTO;
import com.example.starter_project_2025.system.exam.dto.ExamItemAnalysisDTO.ItemDTO;
import com.example.starter_project_2025.system.exam.service.ItemAnalysisCalculator.AttemptResponses;
import com.example.starter_project_2025.system.exam.service.ItemAnalysisCalculator.ItemResponse;
import com.example.starter_project_2025.system.exam.service.ItemAnalysisCalculator.OptionInfo;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** EXM-013: ty le hoan thanh, do kho, do phan biet va phan tich dap an tung cau. */
@Service
@RequiredArgsConstructor
public class ExamItemAnalysisService {

    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultReadinessService readinessService;

    @PersistenceContext
    private EntityManager entityManager;

    @Transactional(readOnly = true)
    public ExamItemAnalysisDTO analyze(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new ResourceNotFoundException("Exam not found"));

        List<ExamAttempt> attempts = attemptRepository.findAllByExam_Id(examId);
        CompletionDTO completion = completion(attempts);

        Map<Long, ExamAttempt> graded = attempts.stream()
                .filter(readinessService::isFullyGraded)
                .collect(Collectors.toMap(ExamAttempt::getId, a -> a));

        List<ItemDTO> items = List.of();
        if (!graded.isEmpty()) {
            items = ItemAnalysisCalculator.analyze(buildResponses(examId, graded));
        }

        Double avgDifficulty = items.stream()
                .map(ItemDTO::difficultyIndex)
                .filter(v -> v != null)
                .mapToDouble(Double::doubleValue)
                .average()
                .stream().boxed().findFirst().map(v -> Math.round(v * 10000.0) / 10000.0).orElse(null);

        return new ExamItemAnalysisDTO(
                exam.getId(),
                exam.getTitle(),
                completion,
                graded.size(),
                graded.size() >= ItemAnalysisCalculator.MIN_ATTEMPTS_FOR_DISCRIMINATION,
                ItemAnalysisCalculator.MIN_ATTEMPTS_FOR_DISCRIMINATION,
                avgDifficulty,
                (int) items.stream().filter(i -> !i.flags().isEmpty()).count(),
                items);
    }

    private CompletionDTO completion(List<ExamAttempt> attempts) {
        long started = attempts.size();
        long submitted = attempts.stream().filter(a -> a.getSubmittedAt() != null).count();
        long inProgress = attempts.stream()
                .filter(a -> a.getStatus() == ExamAttemptStatus.IN_PROGRESS).count();
        long expired = attempts.stream()
                .filter(a -> a.getStatus() == ExamAttemptStatus.EXPIRED).count();
        long pending = attempts.stream()
                .filter(a -> a.getStatus() == ExamAttemptStatus.PENDING_REVIEW).count();
        Double avgMinutes = attempts.stream()
                .filter(a -> a.getSubmittedAt() != null && a.getStartedAt() != null)
                .mapToDouble(a -> Duration.between(a.getStartedAt(), a.getSubmittedAt()).toSeconds() / 60.0)
                .average()
                .stream().boxed().findFirst().map(v -> Math.round(v * 100.0) / 100.0).orElse(null);
        return new CompletionDTO(
                started, submitted, inProgress, expired, pending,
                started == 0 ? null : Math.round(submitted * 10000.0 / started) / 10000.0,
                avgMinutes);
    }

    private List<AttemptResponses> buildResponses(Long examId, Map<Long, ExamAttempt> graded) {
        List<ExamAttemptQuestion> questions = entityManager.createQuery(
                        "select distinct q from ExamAttemptQuestion q left join fetch q.options "
                                + "where q.attempt.exam.id = :examId", ExamAttemptQuestion.class)
                .setParameter("examId", examId)
                .getResultList();
        List<ExamAttemptAnswer> answers = entityManager.createQuery(
                        "select distinct a from ExamAttemptAnswer a left join fetch a.selectedOptions "
                                + "where a.attempt.exam.id = :examId", ExamAttemptAnswer.class)
                .setParameter("examId", examId)
                .getResultList();

        Map<Long, ExamAttemptAnswer> answerByQuestion = new HashMap<>();
        for (ExamAttemptAnswer a : answers) {
            answerByQuestion.put(a.getQuestion().getId(), a);
        }

        Map<Long, List<ExamAttemptQuestion>> byAttempt = new HashMap<>();
        for (ExamAttemptQuestion q : questions) {
            Long attemptId = q.getAttempt().getId();
            if (graded.containsKey(attemptId)) {
                byAttempt.computeIfAbsent(attemptId, k -> new ArrayList<>()).add(q);
            }
        }

        List<AttemptResponses> result = new ArrayList<>();
        for (Map.Entry<Long, List<ExamAttemptQuestion>> e : byAttempt.entrySet()) {
            ExamAttempt attempt = graded.get(e.getKey());
            BigDecimal maxScore = ExamScoring.effectiveMax(attempt.getMaxScore());
            List<ItemResponse> items = new ArrayList<>();
            e.getValue().sort(Comparator.comparingInt(ExamAttemptQuestion::getDisplayOrder));
            for (ExamAttemptQuestion q : e.getValue()) {
                items.add(toResponse(q, answerByQuestion.get(q.getId()), maxScore, attempt.getTotalPoints()));
            }
            result.add(new AttemptResponses(e.getKey(), items));
        }
        return result;
    }

    private ItemResponse toResponse(ExamAttemptQuestion q, ExamAttemptAnswer answer,
                                    BigDecimal maxScore, int totalPoints) {
        Set<Long> selected = answer == null ? Set.of()
                : answer.getSelectedOptions().stream()
                .map(ExamAttemptOption::getSourceOptionId)
                .collect(Collectors.toSet());
        boolean hasText = answer != null && answer.getTextAnswer() != null
                && !answer.getTextAnswer().isBlank();
        boolean answered = q.getType() == QuestionType.MULTIPLE_CHOICE ? !selected.isEmpty() : hasText;

        Double ratio;
        if (q.getType() == QuestionType.MULTIPLE_CHOICE) {
            Set<Long> correct = q.getOptions().stream()
                    .filter(ExamAttemptOption::isCorrect)
                    .map(ExamAttemptOption::getSourceOptionId)
                    .collect(Collectors.toSet());
            ratio = correct.equals(selected) ? 1.0 : 0.0;
        } else if (answer == null) {
            ratio = 0.0;
        } else if (answer.getScore() == null) {
            ratio = null;
        } else {
            BigDecimal cap = ExamScoring.share(maxScore, q.getPoints(), totalPoints);
            ratio = cap.signum() <= 0 ? null
                    : Math.min(1.0, Math.max(0.0, answer.getScore().doubleValue() / cap.doubleValue()));
        }

        List<OptionInfo> options = q.getOptions().stream()
                .map(o -> new OptionInfo(o.getSourceOptionId(), o.getContent(), o.isCorrect()))
                .toList();
        return new ItemResponse(q.getSourceQuestionId(), q.getContent(), q.getType(),
                q.getPoints(), options, selected, answered, ratio);
    }
}
