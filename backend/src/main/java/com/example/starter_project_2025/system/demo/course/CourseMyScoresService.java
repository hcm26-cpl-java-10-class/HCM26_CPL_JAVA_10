package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamResultPublication;
import com.example.starter_project_2025.system.exam.domain.ScoreReleasePolicy;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItem;
import com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItemRepository;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import jakarta.persistence.EntityManager;
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
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CourseMyScoresService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final ExamRepository examRepository;
    private final ExamAttemptRepository attemptRepository;
    private final ExamResultAccessService resultAccessService;
    private final EntityManager entityManager;
    private final GradebookPublishedItemRepository publishedRepository;

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
                .map(enrollment -> publishedScores(enrollment.getCourse(),
                                publishedRepository.findByCourse_IdAndStudent_IdOrderByPositionAsc(
                                        enrollment.getCourse().getId(), studentId))
                        .orElseGet(() -> buildCourseScores(enrollment.getCourse(), bestAttempts)))
                .collect(Collectors.toMap(
                        CourseMyScoresDTO::courseId,
                        dto -> dto,
                        (first, second) -> first
                ))
                .values()
                .stream()
                .toList();
    }

    /**
     * Neu giang vien da bam "Save scores" o Score Management thi My Scores lay ban bang diem do:
     * moi cot diem la mot muc, diem tong = tong(diem x ti trong) / 100 (giong cot Final cua giang vien).
     */
    private java.util.Optional<CourseMyScoresDTO> publishedScores(Course course, List<GradebookPublishedItem> items) {
        if (items == null || items.isEmpty()) {
            return java.util.Optional.empty();
        }
        List<CourseGradeItemDTO> gradeItems = new ArrayList<>();
        BigDecimal sum = BigDecimal.ZERO;
        for (GradebookPublishedItem i : items) {
            String label = i.getExamTitle() != null ? i.getColumnName() + " (" + i.getExamTitle() + ")" : i.getColumnName();
            gradeItems.add(new CourseGradeItemDTO(publishedCategory(i.getColumnType()), i.getExamId(), label,
                    i.getWeightPercent(), i.getScore()));
            if (i.getScore() != null) {
                sum = sum.add(i.getScore().multiply(i.getWeightPercent()));
            }
        }
        BigDecimal overall = sum.divide(HUNDRED, 2, RoundingMode.HALF_UP);
        String status = overall.compareTo(new BigDecimal("5")) >= 0 ? "PASSED" : "FAILED";
        return java.util.Optional.of(new CourseMyScoresDTO(course.getId(), null, course.getName(), null,
                overall, status, gradeItems));
    }

    private String publishedCategory(String type) {
        if (type == null) return "Other";
        return switch (type) {
            case "ASSIGNMENT" -> "Assignment";
            case "QUIZ" -> "Quiz";
            case "MIDTERM" -> "Midterm";
            case "FINAL_TEST" -> "Final";
            default -> type;
        };
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
        return buildCourseScores(course, bestAttempts, exams, resultAccessService::canStudentSeeScoreOnMyScores);
    }

    @Transactional(readOnly = true)
    public Map<Long, List<CourseMyScoresDTO>> findCourseScoresForStudents(Map<Long, List<Course>> studentCourses) {
        Set<Long> studentIds = studentCourses.keySet();
        Set<Long> courseIds = studentCourses.values().stream().flatMap(List::stream)
                .map(Course::getId).collect(Collectors.toSet());
        if (studentIds.isEmpty() || courseIds.isEmpty()) return Map.of();

        List<Exam> exams = entityManager.createQuery(
                        "select e from Exam e join fetch e.course where e.course.id in :courses order by e.id", Exam.class)
                .setParameter("courses", courseIds).getResultList();
        Map<Long, List<Exam>> examsByCourse = exams.stream()
                .collect(Collectors.groupingBy(e -> e.getCourse().getId()));
        List<ExamAttempt> attempts = entityManager.createQuery("""
                select a from ExamAttempt a join fetch a.exam e join fetch a.student s
                where s.id in :students and e.course.id in :courses
                """, ExamAttempt.class).setParameter("students", studentIds)
                .setParameter("courses", courseIds).getResultList();
        Map<Long, List<ExamAttempt>> attemptsByStudent = attempts.stream()
                .collect(Collectors.groupingBy(a -> a.getStudent().getId()));
        List<ExamResultPublication> publications = entityManager.createQuery("""
                select p from ExamResultPublication p join fetch p.exam e where e.course.id in :courses
                """, ExamResultPublication.class).setParameter("courses", courseIds).getResultList();
        Set<Long> publishedExamIds = publications.stream()
                .filter(p -> p.isPublished() && p.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
                .map(p -> p.getExam().getId()).collect(Collectors.toSet());
        Map<Long, List<GradebookPublishedItem>> published = new HashMap<>();
        for (GradebookPublishedItem item : publishedRepository.findForStudents(courseIds, studentIds)) {
            published.computeIfAbsent(item.getStudent().getId() * 1_000_000L + item.getCourse().getId(),
                    k -> new ArrayList<>()).add(item);
        }
        Map<Long, List<CourseMyScoresDTO>> result = new HashMap<>();
        studentCourses.forEach((studentId, courses) -> {
            Map<Long, ExamAttempt> best = selectBestAttempts(attemptsByStudent.getOrDefault(studentId, List.of()));
            result.put(studentId, courses.stream().map(course -> publishedScores(course,
                            published.getOrDefault(studentId * 1_000_000L + course.getId(), List.of()))
                    .orElseGet(() -> buildCourseScores(course, best,
                            examsByCourse.getOrDefault(course.getId(), List.of()),
                            exam -> publishedExamIds.contains(exam.getId())))).toList());
        });
        return result;
    }

    private CourseMyScoresDTO buildCourseScores(
            Course course,
            Map<Long, ExamAttempt> bestAttempts,
            List<Exam> exams,
            Predicate<Exam> visible
    ) {

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
                        && visible.test(exam)) {
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
