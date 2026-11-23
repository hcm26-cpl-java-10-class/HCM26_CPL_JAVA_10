package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.demo.progress.*;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.certificate.CertificateService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.notification.NotificationService;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class CourseAssessmentCompletionServiceTest {
    CourseAssessmentService grades=mock(CourseAssessmentService.class);
    CourseEnrollmentRepository enrollments=mock(CourseEnrollmentRepository.class);
    LessonRepository lessons=mock(LessonRepository.class);
    LessonProgressRepository progress=mock(LessonProgressRepository.class);
    CertificateService certificates=mock(CertificateService.class);
    NotificationService notifications=mock(NotificationService.class);
    CourseAssessmentCompletionService service=new CourseAssessmentCompletionService(grades,enrollments,lessons,progress,certificates,notifications);
    CourseEnrollment enrollment;
    Lesson assessment;
    List<LessonProgress> saved=new ArrayList<>();
    @BeforeEach void setup() {
        Course course=Course.builder().id(1L).name("Java").build();
        enrollment=CourseEnrollment.builder().id(2L).course(course).user(User.builder().id(3L).build()).build();
        Section section=Section.builder().id(4L).course(course).build();
        assessment=Lesson.builder().id(5L).section(section).contentType(LessonContentType.QUIZ).build();
        when(enrollments.findActiveStudentsByCourse(1L)).thenReturn(List.of(enrollment));
        when(lessons.findByCourseIdOrdered(1L)).thenReturn(List.of(assessment));
        when(progress.findAllByEnrollment_Id(2L)).thenAnswer(call->saved);
        when(progress.save(any())).thenAnswer(call->{LessonProgress item=call.getArgument(0);saved.add(item);return item;});
    }
    @Test void publishedPassingResultCompletesLessonAndIssuesCertificate() {
        when(grades.lessonFinished(assessment,3L)).thenReturn(true);when(grades.canComplete(1L,3L)).thenReturn(true);
        service.refreshCourse(1L);
        org.junit.jupiter.api.Assertions.assertTrue(saved.getFirst().isCompleted());
        verify(certificates).issueIfCourseCompleted(enrollment);verify(notifications).createOnce(eq(3L),eq("course-completed:2"),anyString(),anyString(),anyString());
    }
    @Test void failedCourseDoesNotIssueCertificateEvenWhenAssessmentIsFinished() {
        when(grades.lessonFinished(assessment,3L)).thenReturn(true);
        service.refreshCourse(1L);verifyNoInteractions(certificates,notifications);
    }
    @Test void unpublishedOrUngradedAssessmentDoesNotCompleteLesson() {
        service.refreshCourse(1L);verify(progress,never()).save(any());verifyNoInteractions(certificates,notifications);
    }
}
