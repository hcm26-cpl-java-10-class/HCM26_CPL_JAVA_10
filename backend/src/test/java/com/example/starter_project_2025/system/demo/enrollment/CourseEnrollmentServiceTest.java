package com.example.starter_project_2025.system.demo.enrollment;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.department.DepartmentRepository;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.progress.LessonProgress;
import com.example.starter_project_2025.system.demo.progress.LessonProgressRepository;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CourseEnrollmentServiceTest {

    @Mock CourseEnrollmentRepository enrollmentRepository;
    @Mock CourseRepository courseRepository;
    @Mock UserRepository userRepository;
    @Mock DepartmentRepository departmentRepository;
    @Mock LessonRepository lessonRepository;
    @Mock LessonProgressRepository progressRepository;
    @InjectMocks CourseEnrollmentService service;

    @Test
    void allowsCancellationAtExactlyTwentyPercent() {
        CourseEnrollment enrollment = enrollment();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(lessons(5));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(progress(1));

        assertDoesNotThrow(() -> service.cancelEnrollment(7L, 40L));
        verify(enrollmentRepository).delete(enrollment);
    }

    @Test
    void blocksCancellationAboveTwentyPercent() {
        CourseEnrollment enrollment = enrollment();
        when(enrollmentRepository.findByIdAndUser_Id(40L, 7L)).thenReturn(Optional.of(enrollment));
        when(lessonRepository.findByCourseIdOrdered(10L)).thenReturn(lessons(5));
        when(progressRepository.findAllByEnrollment_Id(40L)).thenReturn(progress(2));

        assertThrows(BadRequestException.class, () -> service.cancelEnrollment(7L, 40L));
        verify(enrollmentRepository, never()).delete(any(CourseEnrollment.class));
    }

    private CourseEnrollment enrollment() {
        return CourseEnrollment.builder()
                .id(40L)
                .course(Course.builder().id(10L).name("Course").build())
                .build();
    }

    private List<Lesson> lessons(int count) {
        return java.util.stream.IntStream.range(0, count)
                .mapToObj(index -> (Lesson) Lesson.builder().id((long) index + 1).build())
                .toList();
    }

    private List<LessonProgress> progress(int completed) {
        return java.util.stream.IntStream.range(0, completed)
                .mapToObj(index -> (LessonProgress) LessonProgress.builder().completed(true).build())
                .toList();
    }
}
