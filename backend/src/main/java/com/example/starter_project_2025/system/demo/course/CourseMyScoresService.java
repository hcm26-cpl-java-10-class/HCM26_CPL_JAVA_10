package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseMyScoresService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultAccessService resultAccessService;

    private static final BigDecimal TEN = BigDecimal.TEN;
    private static final BigDecimal HUNDRED = new BigDecimal("100");

    private static final Map<ExamCategory, BigDecimal> CATEGORY_WEIGHTS =
            Map.of(
                    ExamCategory.FINAL_TEST, new BigDecimal("40"),
                    ExamCategory.MIDTERM, new BigDecimal("30"),
                    ExamCategory.ASSIGNMENT, new BigDecimal("20"),
                    ExamCategory.QUIZ, new BigDecimal("10")
            );

    private static final List<ExamCategory> CATEGORY_ORDER = List.of(
            ExamCategory.ASSIGNMENT,
            ExamCategory.MIDTERM,
            ExamCategory.FINAL_TEST,
            ExamCategory.QUIZ
    );

    @Transactional(readOnly = true)
    public List<CourseMyScoresDTO> findMyCourseScores(Long studentId) {
        if (studentId == null) {
            throw new IllegalArgumentException("Student ID is required");
        }

        var enrollments =
                enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(studentId);

        List<ExamAttempt> studentAttempts =
                attemptRepository.findAllByStudent_IdOrderByStartedAtDesc(studentId);

        Map<Long, ExamAttempt> bestAttempts = selectBestAttempts(studentAttempts);

        return enrollments.stream()
                .filter(enrollment -> enrollment.getCourse() != null)
                .map(enrollment -> buildCourseScores(
                        enrollment.getCourse(),
                        bestAttempts
                ))
                .collect(Collectors.toMap(
                        CourseMyScoresDTO::courseId,
                        dto -> dto,
                        (first, second) -> first
                ))
                .values()
                .stream()
                .toList();
    }

    private CourseMyScoresDTO buildCourseScores(
            Course course,
            Map<Long, ExamAttempt> bestAttempts
    ) {
        List<Exam> exams = examRepository.findByCourseLink(
                course.getId(),
                null,
                null,
                false
        );

        EnumMap<ExamCategory, List<Exam>> groupedExams =
                new EnumMap<>(ExamCategory.class);

        for (ExamCategory category : CATEGORY_ORDER) {
            groupedExams.put(category, new ArrayList<>());
        }

        for (Exam exam : exams) {
            if (exam.getCategory() != null
                    && groupedExams.containsKey(exam.getCategory())) {
                groupedExams.get(exam.getCategory()).add(exam);
            }
        }

        BigDecimal activeBaseWeight = groupedExams.entrySet().stream()
                .filter(entry -> !entry.getValue().isEmpty())
                .map(entry -> CATEGORY_WEIGHTS.get(entry.getKey()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<CourseGradeItemDTO> gradeItems = new ArrayList<>();
        List<WeightedScore> scoredItems = new ArrayList<>();

        for (ExamCategory category : CATEGORY_ORDER) {
            List<Exam> categoryExams = groupedExams.get(category);

            if (categoryExams.isEmpty()) {
                gradeItems.add(emptyCategory(category));
                continue;
            }

            BigDecimal adjustedCategoryWeight =
                    CATEGORY_WEIGHTS.get(category)
                            .multiply(HUNDRED)
                            .divide(activeBaseWeight, 8, RoundingMode.HALF_UP);

            BigDecimal itemWeight = adjustedCategoryWeight.divide(
                    BigDecimal.valueOf(categoryExams.size()),
                    8,
                    RoundingMode.HALF_UP
            );

            for (Exam exam : categoryExams) {
                ExamAttempt attempt = bestAttempts.get(exam.getId());

                BigDecimal value = null;

                if (attempt != null
                        && resultAccessService.canStudentSeeScoreOnMyScores(exam)) {
                    value = normalizeScore(
                            attempt.getFinalScore(),
                            exam.getMaxScore()
                    );
                }

                gradeItems.add(new CourseGradeItemDTO(
                        categoryLabel(category),
                        exam.getId(),
                        exam.getTitle(),
                        itemWeight.setScale(2, RoundingMode.HALF_UP),
                        value
                ));

                if (value != null) {
                    scoredItems.add(new WeightedScore(value, itemWeight));
                }
            }
        }

        BigDecimal overall = calculateOverall(scoredItems);

        String resultStatus = overall == null
                ? null
                : overall.compareTo(new BigDecimal("5")) >= 0
                  ? "PASSED"
                  : "FAILED";

        return new CourseMyScoresDTO(
                course.getId(),
                null,
                course.getName(),
                null,
                overall,
                resultStatus,
                gradeItems
        );
    }

    private Map<Long, ExamAttempt> selectBestAttempts(
            List<ExamAttempt> attempts
    ) {
        Map<Long, ExamAttempt> bestAttempts = new HashMap<>();

        Comparator<ExamAttempt> comparator =
                Comparator.comparing(ExamAttempt::getFinalScore)
                        .thenComparing(ExamAttempt::getSubmittedAt)
                        .thenComparing(ExamAttempt::getAttemptNumber);

        for (ExamAttempt attempt : attempts) {
            if (attempt.getExam() == null
                    || attempt.getExam().getId() == null
                    || attempt.getFinalScore() == null
                    || attempt.getSubmittedAt() == null) {
                continue;
            }

            Long examId = attempt.getExam().getId();

            bestAttempts.merge(
                    examId,
                    attempt,
                    (current, candidate) ->
                            comparator.compare(candidate, current) > 0
                                    ? candidate
                                    : current
            );
        }

        return bestAttempts;
    }

    private BigDecimal normalizeScore(
            BigDecimal score,
            BigDecimal maxScore
    ) {
        if (score == null) {
            return null;
        }

        BigDecimal effectiveMax = maxScore == null
                || maxScore.compareTo(BigDecimal.ZERO) <= 0
                ? TEN
                : maxScore;

        return score.multiply(TEN)
                .divide(effectiveMax, 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateOverall(List<WeightedScore> scoredItems) {
        if (scoredItems.isEmpty()) {
            return null;
        }

        BigDecimal totalWeightedScore = BigDecimal.ZERO;
        BigDecimal totalWeight = BigDecimal.ZERO;

        for (WeightedScore item : scoredItems) {
            totalWeightedScore = totalWeightedScore.add(
                    item.value().multiply(item.weight())
            );

            totalWeight = totalWeight.add(item.weight());
        }

        if (totalWeight.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }

        return totalWeightedScore.divide(
                totalWeight,
                2,
                RoundingMode.HALF_UP
        );
    }

    private CourseGradeItemDTO emptyCategory(ExamCategory category) {
        return new CourseGradeItemDTO(
                categoryLabel(category),
                null,
                null,
                null,
                null
        );
    }

    private String categoryLabel(ExamCategory category) {
        return switch (category) {
            case ASSIGNMENT -> "Assignment";
            case MIDTERM -> "Midterm";
            case FINAL_TEST -> "Final";
            case QUIZ -> "Quiz";
        };
    }

    private record WeightedScore(
            BigDecimal value,
            BigDecimal weight
    ) {
    }
}
