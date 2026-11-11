package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.system.demo.certificate.CertificateService;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.analytics.student.StudentLearningActivity;
import com.example.starter_project_2025.system.analytics.student.StudentLearningActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LessonProgressService {

    /** Tối đa số giây được ghi nhận trong 1 lần gọi (chống ghi nhận sai / spam). */
    private static final long MAX_STUDY_SECONDS_PER_CALL = 600L;

    /** Sai số cho phép (giây) giữa thời gian client báo và thời gian thực trôi qua trên server. */
    private static final long STUDY_TIME_SLACK_SECONDS = 5L;

    private final LessonProgressRepository progressRepository;
    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonRepository lessonRepository;
    private final NotificationService notificationService;
    private final CertificateService certificateService;
    private final StudentLearningActivityRepository activityRepository;

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

    /**
     * Ghi nhận thời gian học của học viên cho một bài (tính bằng giây).
     *
     * <p>Thời gian được cộng dồn vào {@code LessonProgress.studySeconds} nên có thể
     * gọi nhiều lần (ví dụ mỗi 30 giây khi người học đang mở bài). Giá trị âm bị bỏ qua,
     * giá trị vượt quá {@code MAX_STUDY_SECONDS_PER_CALL} hoặc vượt quá thời gian thực đã trôi qua
     * kể từ lần cập nhật trước bị chặn để tránh ghi nhận sai.
     */
    @Transactional
    public LessonProgressDTO addStudyTime(Long userId, Long enrollmentId, Long lessonId, long seconds) {
        if (seconds <= 0) {
            return getProgress(userId, enrollmentId);
        }
        long safeSeconds = Math.min(seconds, MAX_STUDY_SECONDS_PER_CALL);

        CourseEnrollment enrollment = getOwnedEnrollmentForUpdate(userId, enrollmentId);
        Lesson lesson = getCourseLesson(enrollment, lessonId);

        LessonProgress progress = progressRepository
                .findByEnrollment_IdAndLesson_Id(enrollmentId, lessonId)
                .orElseGet(() -> LessonProgress.builder()
                        .enrollment(enrollment)
                        .lesson(lesson)
                        .build());

        LocalDateTime now = LocalDateTime.now();
        // Không ghi nhận nhiều hơn thời gian thực đã trôi qua kể từ lần cập nhật trước của bài này,
        // để client không thể gọi liên tục nhằm cộng giờ học ảo.
        if (progress.getLastAccessedAt() != null) {
            long elapsed = Math.max(0L, Duration.between(progress.getLastAccessedAt(), now).getSeconds());
            safeSeconds = Math.min(safeSeconds, elapsed + STUDY_TIME_SLACK_SECONDS);
        }

        long current = progress.getStudySeconds() == null ? 0L : progress.getStudySeconds();
        progress.setStudySeconds(current + safeSeconds);
        progress.setLastAccessedAt(now);
        progressRepository.save(progress);

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
        StudentLearningActivity activity = new StudentLearningActivity();
        activity.setEnrollment(enrollment);
        activity.setOccurredAt(Instant.now());
        activityRepository.save(activity);
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
                progress == null ? null : progress.getLastAccessedAt(),
                progress == null ? null : progress.getStudySeconds()
        );
    }
}
