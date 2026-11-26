package com.example.starter_project_2025.system.demo.lessonreport;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.lesson.CourseContentAccessGuard;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;


@Service
@RequiredArgsConstructor
public class LessonReportService {

    static final int MAX_DETAIL_LENGTH = 1000;
    private static final int MAX_PAGE_SIZE = 50;
    private static final int MESSAGE_EXCERPT = 200;

    private final LessonReportRepository reportRepository;
    private final LessonRepository lessonRepository;
    private final UserRepository userRepository;
    private final CourseContentAccessGuard accessGuard;
    private final ApplicationEventPublisher eventPublisher;

    public record Viewer(Long userId, boolean administrator) {
    }


    @Transactional
    public LessonReportDTO create(Viewer viewer, Long lessonId, LessonReportReason reason, String detail) {
        Lesson lesson = requireLesson(viewer, lessonId);
        Course course = lesson.getSection().getCourse();
        if (!accessGuard.canAccess(course, viewer.userId(), viewer.administrator())) {
            throw forbidden("You do not have access to this lesson");
        }

        String text = normalizeDetail(detail);
        if (reason == LessonReportReason.OTHER && text == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Please describe the problem when choosing \"Other\"");
        }
        if (reportRepository.existsByLesson_IdAndReporter_IdAndStatus(
                lessonId, viewer.userId(), LessonReportStatus.OPEN)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You have already reported this lesson. Your report is being reviewed");
        }

        User reporter = userRepository.findById(viewer.userId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        LessonReport saved = reportRepository.save(LessonReport.builder()
                .lesson(lesson)
                .reporter(reporter)
                .reason(reason)
                .detail(text)
                .build());

        notifyInstructor(course, lesson, reporter, saved);
        return toDto(saved);
    }


    @Transactional(readOnly = true)
    public Page<LessonReportDTO> list(Viewer viewer, Long lessonId, Pageable pageable) {
        Lesson lesson = requireLesson(viewer, lessonId);
        Course course = lesson.getSection().getCourse();
        if (!viewer.administrator() && !accessGuard.isOwner(course, viewer.userId())) {
            throw forbidden("Only the course instructor can view lesson reports");
        }
        return reportRepository.findByLesson_Id(lessonId, newestFirst(pageable)).map(this::toDto);
    }

    @Transactional(readOnly = true)
    public Page<LessonReportInboxDTO> inbox(Viewer viewer, LessonReportStatus status, Pageable pageable) {
        requireLoggedIn(viewer);
        Long instructorId = viewer.administrator() ? null : viewer.userId();
        return reportRepository
                .findAll(LessonReportSpecifications.inbox(instructorId, status), newestFirst(pageable))
                .map(this::toInboxDto);
    }

    @Transactional
    public LessonReportInboxDTO resolve(Viewer viewer, Long reportId) {
        requireLoggedIn(viewer);
        LessonReport report = reportRepository.findWithContextById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found"));
        Course course = report.getLesson().getSection().getCourse();
        if (!viewer.administrator() && !accessGuard.isOwner(course, viewer.userId())) {
            throw forbidden("Only the course instructor can resolve this report");
        }
        report.setStatus(LessonReportStatus.RESOLVED);
        return toInboxDto(reportRepository.save(report));
    }

        private void notifyInstructor(Course course, Lesson lesson, User reporter, LessonReport report) {
        User instructor = course.getInstructorUser();
        if (instructor == null || instructor.getId() == null
                || instructor.getId().equals(reporter.getId())
                || Boolean.FALSE.equals(instructor.getIsActive())) {
            return;
        }
        String message = reporter.getFullName() + " reported \"" + clip(lesson.getTitle(), 80)
                + "\" in " + clip(course.getName(), 80) + ": " + describe(report.getReason());
        eventPublisher.publishEvent(new LessonReportEvents.ReportCreated(
                instructor.getId(), report.getId(), clip(message, 500)));
    }

    private static String describe(LessonReportReason reason) {
        return switch (reason) {
            case BROKEN_CONTENT -> "content does not work";
            case INCORRECT_CONTENT -> "incorrect content";
            case OUTDATED_CONTENT -> "outdated content";
            case INAPPROPRIATE_CONTENT -> "inappropriate content";
            case OTHER -> "other";
        };
    }

    private static String clip(String text, int max) {
        String flat = text == null ? "" : text.strip().replaceAll("\\s+", " ");
        return flat.length() <= max ? flat : flat.substring(0, max - 1).stripTrailing() + "…";
    }

    private static Pageable newestFirst(Pageable pageable) {
        return PageRequest.of(
                Math.max(pageable.getPageNumber(), 0),
                Math.min(Math.max(pageable.getPageSize(), 1), MAX_PAGE_SIZE),
                Sort.by(Sort.Direction.DESC, "createdAt", "id"));
    }

    private static void requireLoggedIn(Viewer viewer) {
        if (viewer == null || viewer.userId() == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Please log in first");
        }
    }

    private Lesson requireLesson(Viewer viewer, Long lessonId) {
        requireLoggedIn(viewer);
        return lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
    }

    private static String normalizeDetail(String raw) {
        if (raw == null) {
            return null;
        }
        String text = raw.replace("\r\n", "\n").replace('\r', '\n').strip();
        return text.isEmpty() ? null : text;
    }

    private LessonReportDTO toDto(LessonReport r) {
        User reporter = r.getReporter();
        return new LessonReportDTO(
                r.getId(),
                r.getLesson().getId(),
                reporter.getId(),
                reporter.getFullName(),
                r.getReason(),
                r.getDetail(),
                r.getStatus(),
                r.getCreatedAt());
    }

    private LessonReportInboxDTO toInboxDto(LessonReport r) {
        Lesson lesson = r.getLesson();
        var section = lesson.getSection();
        Course course = section.getCourse();
        return new LessonReportInboxDTO(
                r.getId(),
                r.getReason(),
                r.getDetail(),
                r.getStatus(),
                r.getCreatedAt(),
                r.getReporter().getId(),
                r.getReporter().getFullName(),
                lesson.getId(),
                lesson.getTitle(),
                section.getId(),
                section.getTitle(),
                course.getId(),
                course.getName());
    }

    private static ResponseStatusException forbidden(String message) {
        return new ResponseStatusException(HttpStatus.FORBIDDEN, message);
    }
}
