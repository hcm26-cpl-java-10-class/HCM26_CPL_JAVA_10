package com.example.starter_project_2025.system.exam.code;

import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.attempt.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.GradeResult;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.TestResult;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CodingScoringTest {

    private static TestResult t(String status) {
        return new TestResult("OK".equals(status), false, status, null, null);
    }

    private static ExamAttemptQuestion question(long id, QuestionType type, int points) {
        ExamAttemptQuestion q = new ExamAttemptQuestion();
        q.setId(id);
        q.setType(type);
        q.setPoints(points);
        return q;
    }

    private static ExamAttempt attempt(int totalPoints, String maxScore) {
        ExamAttempt a = new ExamAttempt();
        a.setTotalPoints(totalPoints);
        a.setMaxScore(maxScore == null ? null : new BigDecimal(maxScore));
        return a;
    }

    private static void answer(ExamAttempt a, ExamAttemptQuestion q, String score) {
        ExamAttemptAnswer ans = new ExamAttemptAnswer();
        ans.setAttempt(a);
        ans.setQuestion(q);
        ans.setScore(score == null ? null : new BigDecimal(score));
        a.getAnswers().add(ans);
    }

    @Test
    void scoreIsProportionalToPassedTests() {
        ExamAttempt a = attempt(10, "10");
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 10);
        GradeResult r = new GradeResult(3, 4, false, null, List.of());
        assertEquals(0, new BigDecimal("7.5").compareTo(CodingScoring.score(a, q, r)));
    }

    @Test
    void scoreUsesShareOfTotalPointsAndMaxScore() {
        ExamAttempt a = attempt(20, "100");
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 5);
        assertEquals(0, new BigDecimal("25").compareTo(CodingScoring.score(a, q, new GradeResult(2, 2, false, null, List.of()))));
        assertEquals(0, BigDecimal.ZERO.compareTo(CodingScoring.score(a, q, new GradeResult(0, 2, false, null, List.of()))));
    }

    @Test
    void scoreFallsBackToDefaultMaxWhenMaxScoreMissing() {
        ExamAttempt a = attempt(5, null);
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 5);
        assertEquals(0, BigDecimal.TEN.compareTo(CodingScoring.score(a, q, new GradeResult(1, 1, false, null, List.of()))));
    }

    @Test
    void feedbackMentionsCompileError() {
        assertEquals("Đạt 2/3 test", CodingScoring.feedback(new GradeResult(2, 3, false, null, List.of())));
        assertEquals("Đạt 0/3 test (lỗi biên dịch)", CodingScoring.feedback(new GradeResult(0, 3, false, "err", List.of())));
    }

    @Test
    void statusesRoundTripThroughJson() {
        GradeResult r = new GradeResult(1, 2, false, null, List.of(t("OK"), t("WRONG_ANSWER")));
        String json = CodingScoring.statusesJson(r);
        assertEquals("[\"OK\",\"WRONG_ANSWER\"]", json);
        assertEquals(List.of("OK", "WRONG_ANSWER"), CodingScoring.statuses(json));
    }

    @Test
    void statusesJsonHandlesNullTests() {
        assertEquals("[]", CodingScoring.statusesJson(new GradeResult(0, 0, false, null, null)));
    }

    @Test
    void noCodeJsonRepeatsStatus() {
        assertEquals("[\"NO_CODE\",\"NO_CODE\",\"NO_CODE\"]", CodingScoring.noCodeJson(3));
        assertEquals("[]", CodingScoring.noCodeJson(0));
    }

    @Test
    void statusesToleratesBlankAndInvalidJson() {
        assertTrue(CodingScoring.statuses(null).isEmpty());
        assertTrue(CodingScoring.statuses("  ").isEmpty());
        assertTrue(CodingScoring.statuses("{oops").isEmpty());
    }

    @Test
    void findAnswerMatchesByQuestionId() {
        ExamAttempt a = attempt(10, "10");
        ExamAttemptQuestion q1 = question(1, QuestionType.CODING, 5);
        ExamAttemptQuestion q2 = question(2, QuestionType.CODING, 5);
        answer(a, q1, "1");
        assertNotNull(CodingScoring.findAnswer(a, q1));
        assertNull(CodingScoring.findAnswer(a, q2));
    }

    @Test
    void recomputeSetsFinalAndSubmitsWhenOnlyCodingAndAllGraded() {
        ExamAttempt a = attempt(10, "10");
        a.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        a.setObjectiveScore(new BigDecimal("6"));
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 10);
        a.getQuestions().add(q);
        answer(a, q, "6");
        CodingScoring.recomputeFinalScore(a, BigDecimal.TEN);
        assertEquals(0, new BigDecimal("6").compareTo(a.getFinalScore()));
        assertEquals(ExamAttemptStatus.SUBMITTED, a.getStatus());
    }

    @Test
    void recomputeWaitsWhileCodingAnswerUngraded() {
        ExamAttempt a = attempt(10, "10");
        a.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        a.setObjectiveScore(BigDecimal.ZERO);
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 10);
        a.getQuestions().add(q);
        answer(a, q, null);
        CodingScoring.recomputeFinalScore(a, BigDecimal.TEN);
        assertNull(a.getFinalScore());
        assertEquals(ExamAttemptStatus.PENDING_REVIEW, a.getStatus());
    }

    @Test
    void recomputeWaitsForEssayWhenNoFinalScoreYet() {
        ExamAttempt a = attempt(10, "10");
        a.setStatus(ExamAttemptStatus.PENDING_REVIEW);
        a.setObjectiveScore(new BigDecimal("3"));
        a.getQuestions().add(question(1, QuestionType.ESSAY, 5));
        a.getQuestions().add(question(2, QuestionType.CODING, 5));
        CodingScoring.recomputeFinalScore(a, BigDecimal.TEN);
        assertNull(a.getFinalScore());
    }

    @Test
    void recomputeAddsEssayAndCapsAtMaxWhenFinalAlreadySet() {
        ExamAttempt a = attempt(10, "10");
        a.setStatus(ExamAttemptStatus.SUBMITTED);
        a.setObjectiveScore(new BigDecimal("8"));
        a.setFinalScore(new BigDecimal("8"));
        ExamAttemptQuestion essay = question(1, QuestionType.ESSAY, 5);
        a.getQuestions().add(essay);
        answer(a, essay, "4");
        CodingScoring.recomputeFinalScore(a, BigDecimal.TEN);
        assertEquals(0, BigDecimal.TEN.compareTo(a.getFinalScore()));
    }

    @Test
    void recomputeAppliesLatePenaltyAndKeepsExpiredStatus() {
        ExamAttempt a = attempt(10, "10");
        a.setStatus(ExamAttemptStatus.EXPIRED);
        a.setObjectiveScore(new BigDecimal("8"));
        a.setLatePenaltyPercentApplied(50);
        ExamAttemptQuestion q = question(1, QuestionType.CODING, 10);
        a.getQuestions().add(q);
        answer(a, q, "8");
        CodingScoring.recomputeFinalScore(a, BigDecimal.TEN);
        assertEquals(0, new BigDecimal("4").compareTo(a.getFinalScore()));
        assertEquals(ExamAttemptStatus.EXPIRED, a.getStatus());
    }
}
