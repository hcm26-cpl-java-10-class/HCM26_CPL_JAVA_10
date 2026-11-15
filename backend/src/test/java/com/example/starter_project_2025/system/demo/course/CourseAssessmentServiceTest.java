package com.example.starter_project_2025.system.demo.course;
import com.example.starter_project_2025.system.exam.domain.*;
import com.example.starter_project_2025.system.question.domain.Question;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
class CourseAssessmentServiceTest {
    static Exam exam(long id,String weight) {
        Exam exam=new Exam();exam.setId(id);exam.setTitle("Assessment "+id);exam.setCategory(ExamCategory.QUIZ);
        exam.setIsActive(true);exam.setCourseWeight(weight==null?null:new BigDecimal(weight));
        Question question=new Question();question.setIsActive(true);exam.getQuestions().add(question);return exam;
    }
    static ExamAttempt attempt(Exam exam,String score,String max) {
        ExamAttempt attempt=new ExamAttempt();attempt.setExam(exam);attempt.setStatus(ExamAttemptStatus.SUBMITTED);
        attempt.setFinalScore(new BigDecimal(score));attempt.setMaxScore(new BigDecimal(max));attempt.setSubmittedAt(Instant.now());return attempt;
    }
    @Test void usesIndividualWeightsAndSnapshotScales() {
        Exam quiz=exam(1,"20"),finalExam=exam(2,"80");
        var result=CourseAssessmentService.calculate(List.of(quiz,finalExam),CourseAssessmentService.best(List.of(attempt(quiz,"10","10"),attempt(finalExam,"50","100"))),e->true);
        assertEquals(new BigDecimal("6.00"),result.overallScore());assertEquals("PASSED",result.status());
        assertEquals(new BigDecimal("20"),result.items().getFirst().gradeWeight());
    }
    @Test void incompleteWeightsNeverFinalizeEvenWithPassingScores() {
        Exam exam=exam(1,"40");
        var result=CourseAssessmentService.calculate(List.of(exam),Map.of(1L,attempt(exam,"10","10")),e->true);
        assertNull(result.overallScore());assertEquals("PLAN_INCOMPLETE",result.status());
    }
    @Test void missingAssessmentDoesNotRescaleRemainingWeights() {
        Exam first=exam(1,"50"),second=exam(2,"50");
        var result=CourseAssessmentService.calculate(List.of(first,second),Map.of(1L,attempt(first,"10","10")),e->true);
        assertNull(result.overallScore());assertEquals("IN_PROGRESS",result.status());
    }
    @Test void unpublishedScoreCannotLeakThroughAggregate() {
        Exam exam=exam(1,"100");
        var result=CourseAssessmentService.calculate(List.of(exam),Map.of(1L,attempt(exam,"9","10")),e->false);
        assertNull(result.overallScore());assertNull(result.items().getFirst().value());assertEquals("AWAITING_RESULTS",result.status());
    }
    @Test void zeroWeightPracticeDoesNotBlockFinalGrade() {
        Exam exam=exam(1,"100"),practice=exam(2,"0");
        var result=CourseAssessmentService.calculate(List.of(exam,practice),Map.of(1L,attempt(exam,"4","10")),e->true);
        assertEquals(new BigDecimal("4.00"),result.overallScore());assertEquals("FAILED",result.status());
    }
    @Test void bestRetakeComparesNormalizedScoresAndIgnoresProvisionalScores() {
        Exam exam=exam(1,"100");ExamAttempt best=attempt(exam,"8","10"),lower=attempt(exam,"9","20"),pending=attempt(exam,"10","10");
        pending.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        assertSame(best,CourseAssessmentService.best(List.of(lower,best,pending)).get(1L));
    }
    @Test void expiredAutoGradedAttemptCountsAndPendingManualGradeDoesNot() {
        Exam exam=exam(1,"100");var expired=attempt(exam,"7","10");expired.setStatus(ExamAttemptStatus.EXPIRED);
        assertTrue(CourseAssessmentService.fullyGraded(expired));expired.setFinalScore(null);
        assertFalse(CourseAssessmentService.fullyGraded(expired));
    }
    @Test void invalidUnconfiguredAndQuestionlessPlansAreNotReady() {
        assertFalse(CourseAssessmentService.plan(List.of(exam(1,null))).ready());
        Exam exam=exam(1,"100");exam.getQuestions().clear();assertFalse(CourseAssessmentService.plan(List.of(exam)).ready());
        exam=exam(1,"100");exam.setIsActive(false);assertFalse(CourseAssessmentService.plan(List.of(exam)).ready());
    }
    @Test void noAssessmentsDoesNotInventAnAcademicGrade() {
        var result=CourseAssessmentService.calculate(List.of(),Map.of(),e->true);
        assertNull(result.overallScore());assertEquals("NO_ASSESSMENTS",result.status());
    }
    @Test void finalGradeRoundingAndPassThresholdAgree() {
        Exam exam=exam(1,"100");
        assertEquals("PASSED",CourseAssessmentService.calculate(List.of(exam),Map.of(1L,attempt(exam,"4.995","10")),e->true).status());
        assertEquals("FAILED",CourseAssessmentService.calculate(List.of(exam),Map.of(1L,attempt(exam,"4.994","10")),e->true).status());
    }
}
