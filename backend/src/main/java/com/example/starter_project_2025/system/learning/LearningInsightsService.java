package com.example.starter_project_2025.system.learning;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentService;
import com.example.starter_project_2025.system.demo.progress.LessonProgressService;
import com.example.starter_project_2025.system.exam.result.dto.PublishedExamScoreDTO;
import com.example.starter_project_2025.system.exam.result.service.PublishedExamScoreService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LearningInsightsService {
    private static final int RECENT_EXAM_LIMIT = 5;

    private final CourseEnrollmentService enrollments;
    private final LessonProgressService progress;
    private final PublishedExamScoreService scores;

    public record CourseProgress(Long courseId, String courseName, int completedLessons, int totalLessons) {}

    public record ExamResult(Long examId, String examTitle, BigDecimal score, BigDecimal maxScore,
                             Instant submittedAt) {}

    public record Snapshot(int enrolledCourses, List<CourseProgress> courseProgress,
                           List<ExamResult> recentExamResults, boolean canReadProgress,
                           boolean canReadExamResults) {
        public boolean hasEvidence() {
            return courseProgress.stream().anyMatch(course -> course.totalLessons() > 0)
                    || !recentExamResults.isEmpty();
        }
    }

    @Transactional(readOnly = true)
    public Snapshot snapshot(Long userId, boolean canReadProgress, boolean canReadExamResults) {
        var courses = enrollments.getMyCourses(userId);
        List<CourseProgress> courseProgress = canReadProgress
                ? courses.stream().map(enrollment -> {
                    var result = progress.getProgress(userId, enrollment.getId());
                    return new CourseProgress(result.courseId(), result.courseName(),
                            result.completedLessons(), result.totalLessons());
                }).toList()
                : List.of();
        List<ExamResult> examResults = canReadExamResults
                ? scores.findMyPublishedScores(userId).stream()
                    .filter(PublishedExamScoreDTO::resultPublished)
                    .filter(score -> score.finalScore() != null && score.maxScore() != null
                            && score.maxScore().signum() > 0)
                    .limit(RECENT_EXAM_LIMIT)
                    .map(score -> new ExamResult(score.examId(), score.examTitle(), score.finalScore(),
                            score.maxScore(), score.submittedAt()))
                    .toList()
                : List.of();
        return new Snapshot(courses.size(), courseProgress, examResults, canReadProgress, canReadExamResults);
    }

    public String nextStep(Snapshot snapshot) {
        return snapshot.courseProgress().stream()
                .filter(course -> course.completedLessons() < course.totalLessons())
                .findFirst()
                .map(course -> "Complete the next lesson in " + course.courseName() + ".")
                .orElseGet(() -> snapshot.recentExamResults().stream()
                        .min(Comparator.comparing(result -> result.score()
                                .divide(result.maxScore(), 6, RoundingMode.HALF_UP)))
                        .map(result -> "Review " + result.examTitle() + ", your lowest score by percentage among the recent results.")
                        .orElseGet(() -> snapshot.hasEvidence() ? "Revisit a completed course and practice a topic from memory." : null));
    }
}
