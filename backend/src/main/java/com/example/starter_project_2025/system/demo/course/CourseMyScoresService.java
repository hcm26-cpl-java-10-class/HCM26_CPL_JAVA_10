package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
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

import java.util.HashMap;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
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
        var grade=CourseAssessmentService.calculatePublished(items);
        return java.util.Optional.of(new CourseMyScoresDTO(course.getId(),null,course.getName(),null,
                course.getThumbnailUrl(),grade.overallScore(),grade.status(),grade.items()));
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
                .filter(p -> p.isPublished() && p.getReleasePolicy()!=null && p.getReleasePolicy() != ScoreReleasePolicy.HIDDEN)
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

        var grade=CourseAssessmentService.calculate(exams,bestAttempts,visible);
        return new CourseMyScoresDTO(course.getId(),null,course.getName(),null,course.getThumbnailUrl(),grade.overallScore(),grade.status(),grade.items());
    }

    private Map<Long, ExamAttempt> selectBestAttempts(
            List<ExamAttempt> attempts
    ) {
        return CourseAssessmentService.best(attempts);
    }
}
