package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Decides whether a student can open a course, section, or lesson exam using LessonProgress. */
@Service
@RequiredArgsConstructor
public class ExamProgressLockService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository progressRepository;
    private final LessonRepository lessonRepository;
    private final com.example.starter_project_2025.system.demo.course.CourseAssessmentService assessments;
    private final ExamRepository examRepository;
    private final UserRepository userRepository;

    public record LockState(boolean locked, String reason) {
        public static final LockState OPEN = new LockState(false, null);
    }

    /** Lock state per exam id. Empty map if the user is not enrolled (nothing to evaluate). */
    @Transactional(readOnly = true)
    public Map<Long, LockState> evaluateAll(List<Exam> exams, Long userId, Long courseId) {
        Set<Long> completed = completedLessonIds(userId, courseId);
        if (completed == null) {
            return Map.of();
        }
        Map<Long, List<Lesson>> sectionCache = new HashMap<>();
        Map<Long, List<Lesson>> courseLessonCache = new HashMap<>();
        Map<Long, LockState> result = new HashMap<>();
        for (Exam e : exams) {
            result.put(e.getId(), evaluate(e, completed, sectionCache, courseLessonCache));
        }
        return result;
    }

    /** Returns lock states for active course exams across the user's enrolled courses. */
    @Transactional(readOnly = true)
    public Map<Long, LockState> lockedExamsForUser(Long userId) {
        if (userId == null) {
            return Map.of();
        }
        Map<Long, LockState> result = new HashMap<>();
        enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(userId).stream()
                .map(enrollment -> enrollment.getCourse().getId())
                .distinct()
                .forEach(courseId -> {
                    List<Exam> exams = examRepository.findByCourseLink(courseId, null, null, true);
                    evaluateAll(exams, userId, courseId).forEach((examId, state) -> {
                        if (state.locked()) {
                            result.put(examId, state);
                        }
                    });
                });
        return result;
    }

    /** Server-side guard so a locked exam can't be started by calling the API directly. */
    @Transactional(readOnly = true)
    public void assertUnlocked(Exam exam, Long userId) {
        if (exam.getCourse() == null) {
            return;
        }
        if (userId == null) {
            if (requiresCourseEnrollment(exam)) {
                throw new AccessDeniedException("You must be enrolled in this course to take this assessment");
            }
            return;
        }
        Set<Long> completed = completedLessonIds(userId, exam.getCourse().getId());
        if (completed == null) {
            if (requiresCourseEnrollment(exam) && !isStaff(userId)) {
                throw new AccessDeniedException("You must be enrolled in this course to take this assessment");
            }
            return;
        }
        assessments.assertReady(exam.getCourse().getId());
        LockState state = evaluate(exam, completed, new HashMap<>(), new HashMap<>());
        if (state.locked()) {
            throw new AccessDeniedException(state.reason());
        }
    }

    private LockState evaluate(
            Exam exam,
            Set<Long> completed,
            Map<Long, List<Lesson>> sectionCache,
            Map<Long, List<Lesson>> courseLessonCache
    ) {
        if (isCourseFinal(exam)) {
            Long courseId = exam.getCourse().getId();
            List<Lesson> lessons = courseLessonCache.computeIfAbsent(
                    courseId, lessonRepository::findActiveByCourseIdOrdered);
            long remaining = lessons.stream()
                    .filter(lesson -> !completed.contains(lesson.getId()))
                    .count();
            if (remaining > 0) {
                return new LockState(true, "Complete all active lessons in course \""
                        + exam.getCourse().getName() + "\" to unlock the final exam (" + remaining + " left)");
            }
            return LockState.OPEN;
        }
        if (exam.getLesson() != null) {
            Lesson lesson = exam.getLesson();
            if (com.example.starter_project_2025.system.demo.course.CourseAssessmentService.isAssessment(lesson)) {
                long remaining=lessonRepository.findBySection_IdOrderByOrderIndexAsc(lesson.getSection().getId()).stream()
                        .filter(l->!Boolean.FALSE.equals(l.getIsActive()))
                        .filter(l->l.getOrderIndex()<lesson.getOrderIndex())
                        .filter(l->!completed.contains(l.getId())).count();
                return remaining==0?LockState.OPEN:new LockState(true,"Complete earlier lessons in this section to unlock this assessment");
            }
            if (!completed.contains(lesson.getId())) {
                return new LockState(true,
                        "Complete the lesson \"" + lesson.getTitle() + "\" to unlock this exam");
            }
            return LockState.OPEN;
        }
        if (exam.getSection() != null) {
            Long sectionId = exam.getSection().getId();
            List<Lesson> lessons = sectionCache.computeIfAbsent(sectionId,
                    id -> lessonRepository.findBySection_IdOrderByOrderIndexAsc(id));
            long remaining = lessons.stream()
                    .filter(l -> !Boolean.FALSE.equals(l.getIsActive()))
                    .filter(l -> !completed.contains(l.getId()))
                    .count();
            if (remaining > 0) {
                return new LockState(true, "Complete all lessons in section \""
                        + exam.getSection().getTitle() + "\" to unlock this exam (" + remaining + " left)");
            }
        }
        return LockState.OPEN;
    }

    public boolean requiresCourseEnrollment(Exam exam) {
        return exam.getCourse() != null
                && (exam.getCategory() == ExamCategory.QUIZ || isCourseFinal(exam));
    }

    private boolean isCourseFinal(Exam exam) {
        return exam.getCategory() == ExamCategory.FINAL_TEST
                && exam.getCourse() != null
                && exam.getSection() == null
                && exam.getLesson() == null;
    }

    private boolean isStaff(Long userId) {
        return userRepository.findById(userId)
                .map(User::getRoles)
                .filter(roles -> roles != null)
                .map(roles -> roles.stream()
                        .anyMatch(role -> "ADMIN".equals(role.getName()) || "TEACHER".equals(role.getName())))
                .orElse(false);
    }

    /** Completed lesson ids of the user's enrollment, or null if the user is not enrolled. */
    private Set<Long> completedLessonIds(Long userId, Long courseId) {
        if (userId == null) {
            return null;
        }
        return enrollmentRepository.findByUser_IdAndCourse_Id(userId, courseId)
                .map(en -> progressRepository.findAllByEnrollment_Id(en.getId()).stream()
                        .filter(LessonProgress::isCompleted)
                        .map(p -> p.getLesson().getId())
                        .collect(Collectors.toSet()))
                .orElse(null);
    }
}