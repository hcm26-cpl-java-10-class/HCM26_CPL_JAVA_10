package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.rbac.role.Role;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExamProgressLockServiceTest {

    private static final Long STUDENT_ID = 7L;
    private static final Long COURSE_ID = 10L;
    private static final Long ENROLLMENT_ID = 20L;

    @Mock
    private CourseEnrollmentRepository enrollmentRepository;
    @Mock
    private LessonProgressRepository progressRepository;
    @Mock
    private LessonRepository lessonRepository;
    @Mock
    private ExamRepository examRepository;
    @Mock
    private UserRepository userRepository;

    @Mock private com.example.starter_project_2025.system.demo.course.CourseAssessmentService assessments;

    @InjectMocks
    private ExamProgressLockService service;

    private Course course;
    private CourseEnrollment enrollment;
    private Lesson firstLesson;
    private Lesson secondLesson;

    @BeforeEach
    void setUp() {
        course = Course.builder().name("Java").build();
        course.setId(COURSE_ID);

        enrollment = CourseEnrollment.builder().course(course).build();
        enrollment.setId(ENROLLMENT_ID);

        Section section = Section.builder()
                .course(course)
                .title("Module 1")
                .orderIndex(1)
                .build();
        section.setId(30L);

        firstLesson = Lesson.builder()
                .section(section)
                .title("Lesson 1")
                .orderIndex(1)
                .build();
        firstLesson.setId(40L);

        secondLesson = Lesson.builder()
                .section(section)
                .title("Lesson 2")
                .orderIndex(2)
                .build();
        secondLesson.setId(41L);
    }

    @Test
    void finalExamRemainsLockedUntilEveryActiveCourseLessonIsComplete() {
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.of(enrollment));
        when(progressRepository.findAllByEnrollment_Id(ENROLLMENT_ID))
                .thenReturn(List.of(completedProgress(firstLesson)));
        when(lessonRepository.findActiveByCourseIdOrdered(COURSE_ID))
                .thenReturn(List.of(firstLesson, secondLesson));

        Exam exam = courseExam(ExamCategory.FINAL_TEST);

        Map<Long, ExamProgressLockService.LockState> locks =
                service.evaluateAll(List.of(exam), STUDENT_ID, COURSE_ID);

        assertTrue(locks.get(exam.getId()).locked());
        assertTrue(locks.get(exam.getId()).reason().contains("1 left"));

        when(progressRepository.findAllByEnrollment_Id(ENROLLMENT_ID))
                .thenReturn(List.of(completedProgress(firstLesson), completedProgress(secondLesson)));

        locks = service.evaluateAll(List.of(exam), STUDENT_ID, COURSE_ID);

        assertFalse(locks.get(exam.getId()).locked());
    }

    @Test
    void finalExamCannotBeStartedWithoutCourseEnrollment() {
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.empty());
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(userWithRole("STUDENT")));

        AccessDeniedException error = assertThrows(
                AccessDeniedException.class,
                () -> service.assertUnlocked(courseExam(ExamCategory.FINAL_TEST), STUDENT_ID)
        );

        assertTrue(error.getMessage().contains("enrolled"));
    }

    @Test
    void moduleQuizCannotBeStartedWithoutCourseEnrollment() {
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.empty());
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(userWithRole("STUDENT")));
        Exam quiz = courseExam(ExamCategory.QUIZ);
        quiz.setSection(firstLesson.getSection());

        assertThrows(AccessDeniedException.class, () -> service.assertUnlocked(quiz, STUDENT_ID));
    }

    @Test
    void staffCanPreviewCourseAssessmentWithoutStudentEnrollment() {
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.empty());
        when(userRepository.findById(STUDENT_ID)).thenReturn(Optional.of(userWithRole("TEACHER")));

        assertDoesNotThrow(() ->
                service.assertUnlocked(courseExam(ExamCategory.FINAL_TEST), STUDENT_ID));
    }

    @Test
    void moduleQuizUsesExistingSectionCompletionRule() {
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.of(enrollment));
        when(progressRepository.findAllByEnrollment_Id(ENROLLMENT_ID))
                .thenReturn(List.of(completedProgress(firstLesson)));
        when(lessonRepository.findBySection_IdOrderByOrderIndexAsc(30L))
                .thenReturn(List.of(firstLesson, secondLesson));

        Exam quiz = courseExam(ExamCategory.QUIZ);
        quiz.setSection(firstLesson.getSection());

        AccessDeniedException error = assertThrows(
                AccessDeniedException.class,
                () -> service.assertUnlocked(quiz, STUDENT_ID)
        );

        assertTrue(error.getMessage().contains("Module 1"));
    }

    @Test
    void lockedExamsForUserReturnsLockedCourseExamsAcrossEnrollments() {
        when(enrollmentRepository.findAllByUser_IdOrderByCreatedAtDesc(STUDENT_ID))
                .thenReturn(List.of(enrollment));
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID, COURSE_ID))
                .thenReturn(Optional.of(enrollment));

        Exam quiz = courseExam(ExamCategory.QUIZ);
        quiz.setSection(firstLesson.getSection());
        when(examRepository.findByCourseLink(COURSE_ID, null, null, true))
                .thenReturn(List.of(quiz));
        when(progressRepository.findAllByEnrollment_Id(ENROLLMENT_ID)).thenReturn(List.of());
        when(lessonRepository.findBySection_IdOrderByOrderIndexAsc(30L))
                .thenReturn(List.of(firstLesson, secondLesson));

        Map<Long, ExamProgressLockService.LockState> locks = service.lockedExamsForUser(STUDENT_ID);

        assertTrue(locks.get(quiz.getId()).locked());
        assertTrue(locks.get(quiz.getId()).reason().contains("Module 1"));
    }

    @Test
    void assessmentLessonDoesNotRequireItselfToBeCompleted() {
        firstLesson.setContentType(com.example.starter_project_2025.system.demo.lesson.LessonContentType.TEXT);
        secondLesson.setContentType(com.example.starter_project_2025.system.demo.lesson.LessonContentType.QUIZ);
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID,COURSE_ID)).thenReturn(Optional.of(enrollment));
        when(progressRepository.findAllByEnrollment_Id(ENROLLMENT_ID)).thenReturn(List.of(completedProgress(firstLesson)));
        when(lessonRepository.findBySection_IdOrderByOrderIndexAsc(30L)).thenReturn(List.of(firstLesson,secondLesson));
        Exam quiz=courseExam(ExamCategory.QUIZ);quiz.setSection(secondLesson.getSection());quiz.setLesson(secondLesson);
        assertDoesNotThrow(()->service.assertUnlocked(quiz,STUDENT_ID));
        org.mockito.Mockito.verify(assessments).assertReady(COURSE_ID);
    }

    @Test
    void earlierLessonStillBlocksAssessmentLesson() {
        secondLesson.setContentType(com.example.starter_project_2025.system.demo.lesson.LessonContentType.QUIZ);
        when(enrollmentRepository.findByUser_IdAndCourse_Id(STUDENT_ID,COURSE_ID)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findBySection_IdOrderByOrderIndexAsc(30L)).thenReturn(List.of(firstLesson,secondLesson));
        Exam quiz=courseExam(ExamCategory.QUIZ);quiz.setSection(secondLesson.getSection());quiz.setLesson(secondLesson);
        assertThrows(AccessDeniedException.class,()->service.assertUnlocked(quiz,STUDENT_ID));
    }

    private Exam courseExam(ExamCategory category) {
        Exam exam = new Exam();
        exam.setId(50L);
        exam.setCourse(course);
        exam.setCategory(category);
        return exam;
    }

    private LessonProgress completedProgress(Lesson lesson) {
        return LessonProgress.builder()
                .enrollment(enrollment)
                .lesson(lesson)
                .completed(true)
                .build();
    }

    private User userWithRole(String roleName) {
        return User.builder()
                .roles(java.util.Set.of(Role.builder().name(roleName).build()))
                .build();
    }
}
