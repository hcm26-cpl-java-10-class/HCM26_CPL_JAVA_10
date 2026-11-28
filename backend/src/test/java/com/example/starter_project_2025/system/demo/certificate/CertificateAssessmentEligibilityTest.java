package com.example.starter_project_2025.system.demo.certificate;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.enrollment.*;
import com.example.starter_project_2025.system.demo.lesson.*;
import com.example.starter_project_2025.system.demo.progress.*;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.rbac.user.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
class CertificateAssessmentEligibilityTest {
    CertificateRepository certificates=mock(CertificateRepository.class);
    LessonRepository lessons=mock(LessonRepository.class);
    LessonProgressRepository progress=mock(LessonProgressRepository.class);
    CourseAssessmentService grades=mock(CourseAssessmentService.class);
    CourseEnrollmentRepository enrollments=mock(CourseEnrollmentRepository.class);
    CertificateServiceImpl service=new CertificateServiceImpl(certificates,mock(CertificateMapper.class),mock(CourseRepository.class),mock(UserRepository.class),lessons,progress,enrollments,grades);
    CourseEnrollment enrollment;
    @BeforeEach void setup() {
        Course course=Course.builder().id(1L).build();enrollment=CourseEnrollment.builder().id(2L).course(course).user(User.builder().id(3L).build()).build();
        Lesson lesson=Lesson.builder().id(4L).section(Section.builder().course(course).build()).build();
        when(lessons.findByCourseIdOrdered(1L)).thenReturn(List.of(lesson));
        when(progress.findAllByEnrollment_Id(2L)).thenReturn(List.of(LessonProgress.builder().lesson(lesson).completed(true).build()));
    }
    @Test void lessonCompletionAloneCannotIssueCertificateForFailedOrPendingGrade() {
        service.issueIfCourseCompleted(enrollment);verify(certificates,never()).save(any());
    }
    @Test void passedCourseAndCompletedLessonsCanIssueCertificate() {
        when(grades.canComplete(1L,3L)).thenReturn(true);service.issueIfCourseCompleted(enrollment);verify(certificates).save(any());
    }
}
