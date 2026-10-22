package com.example.starter_project_2025.system.demo.progress;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class LessonProgressServiceTest {

    @Mock
    LessonProgressRepository progressRepository;
    @Mock
    CourseEnrollmentRepository enrollmentRepository;
    @Mock
    LessonRepository lessonRepository;

    @InjectMocks
    LessonProgressService service;

    CourseEnrollment enrollment;
    Lesson lesson;

    @BeforeEach
    void setUp() {
        Course course = Course.builder().id(10L).name("Java 21").build();
        Section section = Section.builder()
                .id(20L)
                .course(course)
                .title("Introduction")
                .orderIndex(0)
                .build();
        lesson = Lesson.builder()
                .id(30L)
                .section(section)
                .title("Welcome")
                .contentType(LessonContentType.TEXT)
                .textContent("Hello")
                .orderIndex(0)
                .build();
        enrollment = CourseEnrollment.builder().id(40L).course(course).build();
    }

    @Test
    void returnsRealCourseLessonsAndPercentage() {
        LessonProgress completed = LessonProgress.builder()
                .enrollment(enrollment)
                .lesson(lesson)
                .completed(true)
                .build();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(List.of(completed));

        LessonProgressDTO result = service.getProgress(7L, 40L);

        assertEquals(1, result.totalLessons());
        assertEquals(1, result.completedLessons());
        assertEquals(100, result.progressPercentage());
        assertTrue(result.lessons().getFirst().completed());
    }

    @Test
    void marksOwnedCourseLessonComplete() {
        LessonProgress progress = LessonProgress.builder()
                .enrollment(enrollment)
                .lesson(lesson)
                .completed(false)
                .build();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findById(30L)).thenReturn(Optional.of(lesson));
        when(progressRepository.findByEnrollment_IdAndLesson_Id(40L, 30L))
                .thenReturn(Optional.of(progress));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(List.of(progress));
        when(progressRepository.save(any(LessonProgress.class))).thenAnswer(invocation -> invocation.getArgument(0));

        LessonProgressDTO result = service.setCompleted(7L, 40L, 30L, true);

        assertTrue(progress.isCompleted());
        assertNotNull(progress.getCompletedAt());
        assertNotNull(progress.getLastAccessedAt());
        assertEquals(100, result.progressPercentage());
        verify(progressRepository).save(progress);
    }

    @Test
    void completedLessonCannotBeReset() {
        LessonProgress progress = LessonProgress.builder()
                .enrollment(enrollment)
                .lesson(lesson)
                .completed(true)
                .build();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findById(30L)).thenReturn(Optional.of(lesson));
        when(progressRepository.findByEnrollment_IdAndLesson_Id(40L, 30L))
                .thenReturn(Optional.of(progress));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(List.of(progress));

        LessonProgressDTO result = service.setCompleted(7L, 40L, 30L, false);

        assertTrue(progress.isCompleted());
        assertEquals(100, result.progressPercentage());
    }

    @Test
    void recordsAndReturnsLastAccessedLesson() {
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findById(30L)).thenReturn(Optional.of(lesson));
        when(progressRepository.findByEnrollment_IdAndLesson_Id(40L, 30L))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(LessonProgress.builder()
                        .enrollment(enrollment)
                        .lesson(lesson)
                        .build()));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(List.of());

        LessonProgressDTO result = service.recordAccess(7L, 40L, 30L);
        LessonProgressDTO.LessonItem lastLesson = service.getLastLesson(7L, 40L);

        assertEquals(30L, result.lastLessonId());
        assertNotNull(result.lastAccessedAt());
        assertEquals(30L, lastLesson.lessonId());
        verify(enrollmentRepository).save(enrollment);
        verify(progressRepository).save(any(LessonProgress.class));
    }

    @Test
    void savesStudentAnswerForTextLesson() {
        LessonProgress progress = LessonProgress.builder()
                .enrollment(enrollment)
                .lesson(lesson)
                .build();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findById(30L)).thenReturn(Optional.of(lesson));
        when(progressRepository.findByEnrollment_IdAndLesson_Id(40L, 30L))
                .thenReturn(Optional.of(progress));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(List.of(lesson));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(List.of(progress));

        LessonProgressDTO result = service.saveAnswer(7L, 40L, 30L, "My answer");

        assertEquals("My answer", progress.getStudentAnswer());
        assertEquals("My answer", result.lessons().getFirst().studentAnswer());
        verify(progressRepository).save(progress);
    }
}
