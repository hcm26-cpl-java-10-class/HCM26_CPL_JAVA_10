package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/** Decides whether a student can open a lesson/section exam, based on their LessonProgress. */
@Service
@RequiredArgsConstructor
public class ExamProgressLockService {

    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonProgressRepository progressRepository;
    private final LessonRepository lessonRepository;
    private final ExamRepository examRepository;

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
        Map<Long, LockState> result = new HashMap<>();
        for (Exam e : exams) {
            result.put(e.getId(), evaluate(e, completed, sectionCache));
        }
        return result;
    }

    /** Only the LOCKED exams (examId -> state) across every course the user is enrolled in. */
    @Transactional(readOnly = true)
    public Map<Long, LockState> lockedExamsForUser(Long userId) {
        if (userId == null) {
            return Map.of();
        }
        Map<Long, LockState> result = new HashMap<>();
        for (CourseEnrollment enrollment : enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(userId)) {
            Long courseId = enrollment.getCourse().getId();
            List<Exam> exams = examRepository.findByCourseLink(courseId, null, null, true);
            if (exams.isEmpty()) {
                continue;
            }
            evaluateAll(exams, userId, courseId).forEach((examId, state) -> {
                if (state.locked()) {
                    result.putIfAbsent(examId, state);
                }
            });
        }
        return result;
    }

    /** Server-side guard so a locked exam can't be started by calling the API directly. */
    @Transactional(readOnly = true)
    public void assertUnlocked(Exam exam, Long userId) {
        if (exam.getCourse() == null || userId == null) {
            return;
        }
        Set<Long> completed = completedLessonIds(userId, exam.getCourse().getId());
        if (completed == null) {
            return;
        }
        LockState state = evaluate(exam, completed, new HashMap<>());
        if (state.locked()) {
            throw new AccessDeniedException(state.reason());
        }
    }

    private LockState evaluate(Exam exam, Set<Long> completed, Map<Long, List<Lesson>> sectionCache) {
        if (exam.getLesson() != null) {
            Lesson lesson = exam.getLesson();
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