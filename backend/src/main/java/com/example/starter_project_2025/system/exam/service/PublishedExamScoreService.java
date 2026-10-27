package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.dto.PublishedExamScoreDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PublishedExamScoreService {

    private final ExamAttemptRepository attemptRepository;
    private final ExamResultAccessService resultAccessService;

    @Transactional(readOnly = true)
    public List<PublishedExamScoreDTO> findMyPublishedScores(Long studentId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student ID is required");
        }

        List<ExamAttempt> attempts =
                attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId);

        Map<Long, ExamAttempt> latestScoredAttempts = new LinkedHashMap<>();

        for (ExamAttempt attempt : attempts) {
            if (attempt.getExam() == null
                    || attempt.getExam().getId() == null
                    || attempt.getFinalScore() == null
                    || attempt.getSubmittedAt() == null
                    || !resultAccessService.canStudentSeeScoreOnMyScores(attempt.getExam())) {
                continue;
            }

            Long examId = attempt.getExam().getId();

            latestScoredAttempts.merge(
                    examId,
                    attempt,
                    (current, candidate) ->
                            candidate.getAttemptNumber() > current.getAttemptNumber()
                                    ? candidate
                                    : current
            );
        }

        return latestScoredAttempts.values().stream()
                .sorted(Comparator.comparing(
                        ExamAttempt::getSubmittedAt,
                        Comparator.reverseOrder()
                ))
                .map(attempt -> new PublishedExamScoreDTO(
                        attempt.getExam().getId(),
                        attempt.getExam().getTitle(),
                        attempt.getAttemptNumber(),
                        attempt.getObjectiveScore(),
                        attempt.getFinalScore(),
                        ExamScoring.effectiveMax(attempt.getMaxScore()),
                        attempt.getSubmittedAt()
                ))
                .toList();
    }
}
