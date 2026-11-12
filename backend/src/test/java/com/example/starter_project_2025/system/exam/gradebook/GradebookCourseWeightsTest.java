package com.example.starter_project_2025.system.exam.gradebook;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.demo.course.*;
import com.example.starter_project_2025.system.demo.enrollment.CourseEnrollmentRepository;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.exam.service.ExamAccessGuard;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import java.math.BigDecimal;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GradebookCourseWeightsTest {
    @Mock GradebookColumnRepository columns;
    @Mock GradebookScoreRepository scores;
    @Mock CourseRepository courses;
    @Mock CourseEnrollmentRepository enrollments;
    @Mock ExamRepository exams;
    @Mock ExamAttemptRepository attempts;
    @Mock ExamAccessGuard access;
    @Mock GradebookStateRepository state;
    @Mock GradebookPublishedItemRepository published;
    @Mock CourseAssessmentCompletionService completion;
    @InjectMocks GradebookService service;
    UserPrincipal principal=mock(UserPrincipal.class);

    @BeforeEach void setup() {
        when(courses.findById(1L)).thenReturn(Optional.of(Course.builder().id(1L).name("Java").build()));
        when(access.isAdmin(principal)).thenReturn(true);
    }
    private Exam exam(long id,ExamCategory category,String weight) {
        Exam exam=new Exam();
        exam.setId(id);exam.setCategory(category);exam.setCourseWeight(weight==null?null:new BigDecimal(weight));
        return exam;
    }
    @Test void freshGradebookUsesCreatorsConfiguredCourseWeights() {
        when(exams.findByCourseLink(1L,null,null,true)).thenReturn(List.of(
                exam(1,ExamCategory.QUIZ,"20"),exam(2,ExamCategory.FINAL_TEST,"80")));
        when(columns.save(any())).thenAnswer(call->call.getArgument(0));
        service.autoScan(1L,principal);
        var captor=ArgumentCaptor.forClass(GradebookColumn.class);
        verify(columns,times(2)).save(captor.capture());
        assertEquals(List.of(new BigDecimal("20.00"),new BigDecimal("80.00")),
                captor.getAllValues().stream().map(GradebookColumn::getWeightPercent).toList());
    }
    @Test void scanPreservesTeachersExistingGradebookWeightEdits() {
        Exam quiz=exam(1,ExamCategory.QUIZ,"20"),finalExam=exam(2,ExamCategory.FINAL_TEST,"80");
        GradebookColumn existing=GradebookColumn.builder().id(3L).course(Course.builder().id(1L).build()).sourceExam(quiz)
                .type("QUIZ").weightPercent(new BigDecimal("35")).build();
        when(columns.findByCourse_IdOrderByPositionAscIdAsc(1L)).thenReturn(List.of(existing));
        when(exams.findByCourseLink(1L,null,null,true)).thenReturn(List.of(quiz,finalExam));
        when(columns.save(any())).thenAnswer(call->call.getArgument(0));
        service.autoScan(1L,principal);
        assertEquals(new BigDecimal("35"),existing.getWeightPercent());
        var captor=ArgumentCaptor.forClass(GradebookColumn.class);
        verify(columns).save(captor.capture());
        assertEquals(new BigDecimal("0.00"),captor.getValue().getWeightPercent());
    }
}
