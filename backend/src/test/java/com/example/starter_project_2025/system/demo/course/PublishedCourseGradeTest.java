package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptRepository;
import com.example.starter_project_2025.system.exam.domain.ExamRepository;
import com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItem;
import com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItemRepository;
import com.example.starter_project_2025.system.exam.service.ExamResultAccessService;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublishedCourseGradeTest {
    private GradebookPublishedItem item(String weight,String score) {
        return GradebookPublishedItem.builder().columnType("QUIZ").columnName("Quiz")
                .weightPercent(new BigDecimal(weight)).score(score==null?null:new BigDecimal(score)).build();
    }

    @Test void explicitGradebookSnapshotOverridesUnpublishedExamAttempts() {
        var published=mock(GradebookPublishedItemRepository.class);
        var exams=mock(ExamRepository.class);
        var attempts=mock(ExamAttemptRepository.class);
        var access=mock(ExamResultAccessService.class);
        when(published.findByCourse_IdAndStudent_IdOrderByPositionAsc(1L,2L))
                .thenReturn(List.of(item("20","10"),item("80","5")));
        var service=new CourseAssessmentService(exams,attempts,access,mock(LessonRepository.class),published);
        var grade=service.grade(1L,2L);
        assertEquals(new BigDecimal("6.00"),grade.overallScore());
        assertEquals("PASSED",grade.status());
        verifyNoInteractions(exams,attempts,access);
    }

    @Test void missingSavedScoreStaysPendingWithoutRescalingOtherWeights() {
        var grade=CourseAssessmentService.calculatePublished(List.of(item("20","10"),item("80",null)));
        assertNull(grade.overallScore());
        assertEquals("IN_PROGRESS",grade.status());
    }

    @Test void savedPracticeScoreIsOptionalButAllocationMustBeComplete() {
        var grade=CourseAssessmentService.calculatePublished(List.of(item("100","7"),item("0",null)));
        assertEquals(new BigDecimal("7.00"),grade.overallScore());
        assertEquals("PLAN_INCOMPLETE",CourseAssessmentService.calculatePublished(List.of(item("20","10"))).status());
    }
}
