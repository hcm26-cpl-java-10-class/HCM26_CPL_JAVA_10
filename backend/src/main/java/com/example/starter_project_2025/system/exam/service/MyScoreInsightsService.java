package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.CourseLessonStats;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.AttemptPoint;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.ClassAverage;
import com.example.starter_project_2025.system.exam.dto.MyScoreInsightsDTO.CourseInfo;
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
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository progressRepository;
    private final LessonRepository lessonRepository;
    private final ExamRepository examRepository;

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

        List<Long> awaiting = mine.stream()
                .map(a -> a.getExam().getId())
                .filter(id -> !publishedByExam.get(id))
                .distinct()
                .toList();

        List<ExamAttempt> published = mine.stream()
                .filter(a -> publishedByExam.get(a.getExam().getId()) && a.getFinalScore() != null)
                .sorted(Comparator.comparing(ExamAttempt::getSubmittedAt))
                .toList();

        List<AttemptPoint> points = published.stream().map(this::toPoint).toList();

        List<Long> pendingAppeals = appealRepository.findByStudent_IdOrderByCreatedAtDesc(studentId).stream()
                .filter(ap -> ap.getStatus() == ScoreAppealStatus.PENDING)
                .map(ap -> ap.getExam().getId())
                .toList();

        return new MyScoreInsightsDTO(
                points,
                classAverages(published),
                awaiting,
                pendingAppeals,
                accuracyByExamType(published),
                courses(studentId)
        );
    }

    private List<CourseInfo> courses(Long studentId) {
        List<CourseEnrollment> enrollments = enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(studentId).stream()
                .filter(e -> e.getCourse() != null)
                .toList();
        if (enrollments.isEmpty()) {
            return List.of();
        }
        List<Long> courseIds = enrollments.stream().map(e -> e.getCourse().getId()).distinct().toList();
        Map<Long, Long> lessonCounts = new HashMap<>();
        for (CourseLessonStats stats : lessonRepository.findStatsByCourseIds(courseIds)) {
            lessonCounts.put(stats.courseId(), stats.lessonCount());
        }
        Map<Long, CourseInfo> byCourse = new LinkedHashMap<>();
        for (CourseEnrollment enrollment : enrollments) {
            Long courseId = enrollment.getCourse().getId();
            if (byCourse.containsKey(courseId)) {
                continue;
            }
            long total = lessonCounts.getOrDefault(courseId, 0L);
            long done = progressRepository.findAllByEnrollment_Id(enrollment.getId()).stream()
                    .filter(LessonProgress::isCompleted)
                    .count();
            List<Long> examIds = examRepository.findByCourseLink(courseId, null, null, false).stream()
                    .map(Exam::getId)
                    .toList();
            byCourse.put(courseId, new CourseInfo(
                    courseId,
                    enrollment.getCourse().getName(),
                    enrollment.getCreatedAt(),
                    total,
                    Math.min(done, total),
                    examIds
            ));
        }
        return new ArrayList<>(byCourse.values());
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

    private List<TypeAccuracy> accuracyByExamType(List<ExamAttempt> published) {
        // key: examId -> type -> [earned, possible, questions]
        Map<Long, Map<QuestionType, BigDecimal[]>> acc = new LinkedHashMap<>();
        Map<Long, Map<QuestionType, Integer>> counts = new HashMap<>();

        for (ExamAttempt a : published) {
            long totalWeight = a.getQuestions().stream().mapToLong(ExamAttemptQuestion::getPoints).sum();
            if (totalWeight <= 0) {
                continue;
            }
            Long examId = a.getExam().getId();
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
                BigDecimal[] pair = acc.computeIfAbsent(examId, id -> new EnumMap<>(QuestionType.class))
                        .computeIfAbsent(q.getType(), t -> new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO});
                pair[0] = pair[0].add(earned.min(possible));
                pair[1] = pair[1].add(possible);
                counts.computeIfAbsent(examId, id -> new EnumMap<>(QuestionType.class)).merge(q.getType(), 1, Integer::sum);
            }
        }

        List<TypeAccuracy> out = new ArrayList<>();
        acc.forEach((examId, byType) -> byType.forEach((type, pair) -> {
            if (pair[1].signum() > 0) {
                out.add(new TypeAccuracy(
                        examId,
                        type,
                        counts.get(examId).get(type),
                        pair[0].setScale(2, RoundingMode.HALF_UP),
                        pair[1].setScale(2, RoundingMode.HALF_UP)
                ));
            }
        }));
        return out;
    }
}
