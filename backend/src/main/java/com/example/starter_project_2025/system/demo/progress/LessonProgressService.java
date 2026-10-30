package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.system.demo.certificate.CertificateService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LessonProgressService {

    private final LessonProgressRepository progressRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonRepository lessonRepository;
    private final NotificationService notificationService;
    private final CertificateService certificateService;

    @Transactional(readOnly = true)
    public LessonProgressDTO getProgress(Long userId, Long enrollmentId) {
        CourseEnrollment enrollment = getOwnedEnrollment(userId, enrollmentId);
        return buildProgress(enrollment);
    }

    @Transactional
    public LessonProgressDTO setCompleted(
            Long userId,
            Long enrollmentId,
            Long lessonId,
            boolean completed
    ) {
        CourseEnrollment enrollment = getOwnedEnrollmentForUpdate(userId, enrollmentId);
        Lesson lesson = getCourseLesson(enrollment, lessonId);

        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLesson_Id(enrollmentId, lessonId)
                .orElseGet(() -> LessonProgress.builder()
                        .enrollment(enrollment)
                        .lesson(lesson)
                        .build());

        LocalDateTime now = LocalDateTime.now();
        progress.setLastAccessedAt(now);
        if (completed && !progress.isCompleted()) {
            progress.setCompleted(true);
            progress.setCompletedAt(now);
        }
        progressRepository.save(progress);
        updateLastAccess(enrollment, lessonId, now);

        if (completed) {
            certificateService.issueIfCourseCompleted(enrollment);
        }

        LessonProgressDTO result = buildProgress(enrollment);
        if (result.progressPercentage() == 100) {
            notificationService.createOnce(
                    userId,
                    "course-completed:" + enrollmentId,
                    "Course completed",
                    "You completed " + enrollment.getCourse().getName() + ".",
                    "/courses/" + enrollment.getCourse().getId()
            );
        }
        return result;
    }

    @Transactional
    public LessonProgressDTO recordAccess(Long userId, Long enrollmentId, Long lessonId) {
        CourseEnrollment enrollment = getOwnedEnrollmentForUpdate(userId, enrollmentId);
        Lesson lesson = getCourseLesson(enrollment, lessonId);
        LocalDateTime now = LocalDateTime.now();

        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLesson_Id(enrollmentId, lessonId)
                .orElseGet(() -> LessonProgress.builder()
                        .enrollment(enrollment)
                        .lesson(lesson)
                        .build());
        progress.setLastAccessedAt(now);
        progressRepository.save(progress);
        updateLastAccess(enrollment, lessonId, now);

        return buildProgress(enrollment);
    }

    @Transactional
    public LessonProgressDTO saveAnswer(Long userId, Long enrollmentId, Long lessonId, String answer) {
        CourseEnrollment enrollment = getOwnedEnrollmentForUpdate(userId, enrollmentId);
        Lesson lesson = getCourseLesson(enrollment, lessonId);
        if (lesson.getContentType() != LessonContentType.TEXT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Answers are only supported for text lessons");
        }
        if (answer != null && answer.length() > 10_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Answer must not exceed 10000 characters");
        }

        LocalDateTime now = LocalDateTime.now();
        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLesson_Id(enrollmentId, lessonId)
                .orElseGet(() -> LessonProgress.builder()
                        .enrollment(enrollment)
                        .lesson(lesson)
                        .build());
        progress.setStudentAnswer(answer == null || answer.isBlank() ? null : answer);
        progress.setLastAccessedAt(now);
        progressRepository.save(progress);
        updateLastAccess(enrollment, lessonId, now);

        return buildProgress(enrollment);
    }

    @Transactional(readOnly = true)
    public LessonProgressDTO.LessonItem getLastLesson(Long userId, Long enrollmentId) {
        CourseEnrollment enrollment = getOwnedEnrollment(userId, enrollmentId);
        if (enrollment.getLastLessonId() == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No lesson has been accessed yet");
        }
        Lesson lesson = getCourseLesson(enrollment, enrollment.getLastLessonId());
        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLesson_Id(enrollmentId, lesson.getId())
                .orElse(null);
        return toItem(lesson, progress);
    }

    private CourseEnrollment getOwnedEnrollment(Long userId, Long enrollmentId) {
        return enrollmentRepository.findByIdAndUser_Id(enrollmentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
    }

    private CourseEnrollment getOwnedEnrollmentForUpdate(Long userId, Long enrollmentId) {
        return enrollmentRepository.findOwnedByIdForUpdate(enrollmentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
    }

    private Lesson getCourseLesson(CourseEnrollment enrollment, Long lessonId) {
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
        if (!enrollment.getCourse().getId().equals(lesson.getSection().getCourse().getId())) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Lesson does not belong to the enrolled course"
            );
        }
        return lesson;
    }

    private void updateLastAccess(CourseEnrollment enrollment, Long lessonId, LocalDateTime accessedAt) {
        enrollment.setLastLessonId(lessonId);
        enrollment.setLastAccessedAt(accessedAt);
        enrollmentRepository.save(enrollment);
    }

    private LessonProgressDTO buildProgress(CourseEnrollment enrollment) {
        List<Lesson> lessons = lessonRepository.findByCourseIdOrdered(enrollment.getCourse().getId());
        Map<Long, LessonProgress> progressByLesson = progressRepository
                .findAllByEnrollment_Id(enrollment.getId())
                .stream()
                .collect(Collectors.toMap(item -> item.getLesson().getId(), Function.identity()));

        List<LessonProgressDTO.LessonItem> items = lessons.stream()
                .map(lesson -> toItem(lesson, progressByLesson.get(lesson.getId())))
                .toList();
        int completedLessons = (int) items.stream().filter(LessonProgressDTO.LessonItem::completed).count();
        int percentage = items.isEmpty() ? 0 : completedLessons * 100 / items.size();

        return new LessonProgressDTO(
                enrollment.getId(),
                enrollment.getCourse().getId(),
                enrollment.getCourse().getName(),
                items.size(),
                completedLessons,
                percentage,
                enrollment.getLastLessonId(),
                enrollment.getLastAccessedAt(),
                items
        );
    }

    private LessonProgressDTO.LessonItem toItem(Lesson lesson, LessonProgress progress) {
        return new LessonProgressDTO.LessonItem(
                lesson.getId(),
                lesson.getSection().getId(),
                lesson.getSection().getTitle(),
                lesson.getTitle(),
                lesson.getContentType(),
                lesson.getContentUrl(),
                lesson.getTextContent(),
                lesson.getDuration(),
                lesson.getOrderIndex(),
                progress == null ? null : progress.getStudentAnswer(),
                progress != null && progress.isCompleted(),
                progress == null ? null : progress.getCompletedAt(),
                progress == null ? null : progress.getLastAccessedAt()
        );
    }
}
