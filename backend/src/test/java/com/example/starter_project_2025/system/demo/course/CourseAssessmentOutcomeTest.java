package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.exam.attempt.domain.*;
import com.example.starter_project_2025.system.exam.core.domain.*;
import com.example.starter_project_2025.system.exam.result.service.ExamResultAccessService;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.exam.gradebook.GradebookPublishedItemRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import java.math.BigDecimal;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class CourseAssessmentOutcomeTest {
    ExamRepository exams=mock(ExamRepository.class);
    ExamAttemptRepository attempts=mock(ExamAttemptRepository.class);
    ExamResultAccessService access=mock(ExamResultAccessService.class);
    CourseAssessmentService service=new CourseAssessmentService(exams,attempts,access,mock(LessonRepository.class),mock(GradebookPublishedItemRepository.class),mock(com.example.starter_project_2025.system.exam.gradebook.GradebookTemplateProvider.class));
    Exam exam=new Exam();
    CourseAssessmentOutcomeTest(){exam.setId(5L);exam.setPassScore(new BigDecimal("90"));when(exams.findByCourseLink(1L,null,null,true)).thenReturn(List.of(exam));}
    ExamAttempt attempt(String score){var a=new ExamAttempt();a.setExam(exam);a.setStatus(ExamAttemptStatus.SUBMITTED);a.setSubmittedAt(Instant.now());a.setMaxScore(new BigDecimal("100"));a.setFinalScore(new BigDecimal(score));a.setPassScore(new BigDecimal("60"));return a;}
    @Test void publishedPassingAndFailingUseFrozenThresholdWithoutExposingScore(){
        when(access.canStudentViewScore(exam)).thenReturn(true);
        when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(attempt("65")));
        assertEquals(Map.of(5L,"PASSED"),service.assessmentOutcomes(1L,7L));
        when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(attempt("59")));
        assertEquals(Map.of(5L,"FAILED"),service.assessmentOutcomes(1L,7L));
        verify(attempts,never()).findAllByStudent_IdOrderByStartedAtDesc(8L);
    }
    @Test void hiddenResultsNeverRevealWhetherTheyPassed(){
        for(String score:List.of("10","95")) {when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(attempt(score)));assertEquals("AWAITING_RESULTS",service.assessmentOutcomes(1L,7L).get(5L));}
    }
    @Test void retakeDoesNotEraseBestPublishedResultAndProvisionalScoresAreNeutral(){
        when(access.canStudentViewScore(exam)).thenReturn(true);
        var pending=attempt("100");pending.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(attempt("40"),attempt("80"),pending));
        assertEquals("PASSED",service.assessmentOutcomes(1L,7L).get(5L));
        when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(pending));
        assertEquals("AWAITING_RESULTS",service.assessmentOutcomes(1L,7L).get(5L));
        pending.setStatus(ExamAttemptStatus.IN_PROGRESS);assertEquals("IN_PROGRESS",service.assessmentOutcomes(1L,7L).get(5L));
    }
    @Test void noAttemptsOrNoConfiguredThresholdNeverInventPassOrFail(){
        assertEquals("NOT_STARTED",service.assessmentOutcomes(1L,7L).get(5L));
        exam.setPassScore(null);var a=attempt("65");a.setPassScore(null);
        when(access.canStudentViewScore(exam)).thenReturn(true);when(attempts.findAllByStudent_IdOrderByStartedAtDesc(7L)).thenReturn(List.of(a));
        assertEquals("COMPLETED",service.assessmentOutcomes(1L,7L).get(5L));
    }
}
