package com.example.starter_project_2025.system.demo.lesson;

import com.example.starter_project_2025.system.demo.certificate.CertificateRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollment;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.notification.NotificationService;
import com.example.starter_project_2025.system.rbac.user.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LessonServiceImplNotificationTest {

    @Mock LessonRepository lessonRepository;
    @Mock LessonMapper lessonMapper;
    @Mock SectionRepository sectionRepository;
    @Mock CourseContentAccessGuard contentAccessGuard;
    @Mock CourseEnrollmentRepository enrollmentRepository;
    @Mock NotificationService notificationService;
    @Mock CertificateRepository certificateRepository;

    @InjectMocks
    LessonServiceImpl service;

    Course course;
    Lesson lesson;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("teacher", null,
                        List.of(new SimpleGrantedAuthority("LESSON_UPDATE"),
                                new SimpleGrantedAuthority("LESSON_DELETE"))));

        course = Course.builder().id(10L).name("Java 21").build();
        course.setStatus(CourseStatus.PUBLISHED);
        Section section = Section.builder().id(20L).course(course).title("Intro").orderIndex(0).build();
        lesson = Lesson.builder()
                .id(30L).section(section).title("Welcome")
                .contentType(LessonContentType.TEXT).textContent("Old text").orderIndex(0)
                .build();

        when(lessonRepository.findById(30L)).thenReturn(Optional.of(lesson));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private CourseEnrollment enrollment(long enrollmentId, long userId) {
        User user = mock(User.class);
        when(user.getId()).thenReturn(userId);
        return CourseEnrollment.builder().id(enrollmentId).user(user).course(course).build();
    }

    private LessonDTO textUpdate(String text) {
        LessonDTO dto = new LessonDTO();
        dto.setTextContent(text);
        return dto;
    }

    @Test
    void updateNotifiesEnrolledStudentsButSkipsCertificateHolders() {
        when(lessonRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(lessonMapper.toResponse(any())).thenReturn(new LessonDTO());
        when(certificateRepository.findUserIdsByCourseId(10L)).thenReturn(Set.of(2L));
        when(enrollmentRepository.findAllByCourse_Id(10L))
                .thenReturn(List.of(enrollment(100L, 1L), enrollment(101L, 2L)));

        service.update(30L, textUpdate("New text"));

        verify(notificationService).createOnce(
                eq(1L), anyString(), eq("Lesson updated"), anyString(), eq("/enrollments/100/learn"));
        verify(notificationService, never()).createOnce(
                eq(2L), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void updateWithNoContentChangeSendsNothing() {
        when(lessonRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(lessonMapper.toResponse(any())).thenReturn(new LessonDTO());

        service.update(30L, textUpdate("Old text"));

        verify(notificationService, never()).createOnce(
                any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void updateOnUnpublishedCourseSendsNothing() {
        course.setStatus(CourseStatus.DRAFT);
        when(lessonRepository.save(any())).thenAnswer(i -> i.getArgument(0));
        when(lessonMapper.toResponse(any())).thenReturn(new LessonDTO());

        service.update(30L, textUpdate("New text"));

        verify(notificationService, never()).createOnce(
                any(), anyString(), anyString(), anyString(), anyString());
    }

    @Test
    void deleteNotifiesEnrolledStudentsExceptCertificateHolders() {
        when(certificateRepository.findUserIdsByCourseId(10L)).thenReturn(Set.of(2L));
        when(enrollmentRepository.findAllByCourse_Id(10L))
                .thenReturn(List.of(enrollment(100L, 1L), enrollment(101L, 2L)));

        service.delete(30L);

        verify(notificationService).createOnce(
                eq(1L), anyString(), eq("Lesson removed"), anyString(), eq("/enrollments/100/learn"));
        verify(notificationService, never()).createOnce(
                eq(2L), anyString(), anyString(), anyString(), anyString());
    }
}
