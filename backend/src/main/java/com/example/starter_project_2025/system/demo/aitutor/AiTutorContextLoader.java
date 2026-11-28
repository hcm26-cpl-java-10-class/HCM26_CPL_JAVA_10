package com.example.starter_project_2025.system.demo.aitutor;

import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * Loads (and authorizes) the lesson a learner is asking about. It lives in its own bean so the
 * database transaction ends before the slow AI call starts.
 */
@Component
@RequiredArgsConstructor
public class AiTutorContextLoader {

    /** Graded content: the tutor must never help with these. */
    static final Set<LessonContentType> GRADED_TYPES =
            Set.of(LessonContentType.QUIZ, LessonContentType.EXAM, LessonContentType.ASSIGNMENT);

    private final CourseEnrollmentRepository enrollmentRepository;
    private final LessonRepository lessonRepository;

    public record LessonContext(String courseName, String sectionTitle, String lessonTitle, String text) {
    }

    @Transactional(readOnly = true)
    public LessonContext load(Long userId, Long enrollmentId, Long lessonId) {
        CourseEnrollment enrollment = enrollmentRepository.findByIdAndUser_Id(enrollmentId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Enrollment not found"));
        Lesson lesson = lessonRepository.findById(lessonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Lesson not found"));
        if (!enrollment.getCourse().getId().equals(lesson.getSection().getCourse().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Lesson does not belong to the enrolled course");
        }
        if (GRADED_TYPES.contains(lesson.getContentType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "The AI Tutor is not available on graded assessments");
        }
        return new LessonContext(
                enrollment.getCourse().getName(),
                lesson.getSection().getTitle(),
                lesson.getTitle(),
                lesson.getTextContent());
    }
}
