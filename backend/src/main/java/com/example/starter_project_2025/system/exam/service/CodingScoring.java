package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.code.CodeJudgeService.GradeResult;
import com.example.starter_project_2025.system.exam.code.CodeJudgeService.TestResult;
import com.example.starter_project_2025.system.exam.domain.ExamAttempt;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptAnswer;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptQuestion;
import com.example.starter_project_2025.system.exam.domain.ExamAttemptStatus;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Tinh diem cau lap trinh va luu/doc ket qua tung test (dung chung cho cham nen va cham lai). */
final class CodingScoring {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CodingScoring() {
    }

    /** Diem cua cau theo ty le test dat (10 test => moi test 10% diem cau). */
    static BigDecimal score(ExamAttempt attempt, ExamAttemptQuestion question, GradeResult result) {
        BigDecimal weight = BigDecimal.valueOf(question.getPoints())
                .multiply(BigDecimal.valueOf(result.passed()))
                .divide(BigDecimal.valueOf(result.total()), 8, RoundingMode.HALF_UP);
        return ExamScoring.share(ExamScoring.effectiveMax(attempt.getMaxScore()), weight, attempt.getTotalPoints());
    }

    static String feedback(GradeResult result) {
        return "Đạt " + result.passed() + "/" + result.total() + " test"
                + (result.compileError() != null ? " (lỗi biên dịch)" : "");
    }

    /** Trang thai tung test theo thu tu khai bao, dang JSON, vd ["OK","WRONG_ANSWER"]. */
    static String statusesJson(GradeResult result) {
        List<String> statuses = new ArrayList<>();
        if (result.tests() != null) {
            for (TestResult t : result.tests()) {
                statuses.add(t.status());
            }
        }
        return write(statuses);
    }

    static String noCodeJson(int testCount) {
        return write(Collections.nCopies(testCount, "NO_CODE"));
    }

    static List<String> statuses(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return MAPPER.readValue(json, new TypeReference<List<String>>() { });
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private static String write(List<String> statuses) {
        try {
            return MAPPER.writeValueAsString(statuses);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    static ExamAttemptAnswer findAnswer(ExamAttempt attempt, ExamAttemptQuestion question) {
        return attempt.getAnswers().stream()
                .filter(a -> a.getQuestion() != null && a.getQuestion().getId().equals(question.getId()))
                .findFirst()
                .orElse(null);
    }

    /**
     * Tinh lai diem cuoi sau khi mot cau coding duoc cham. Khong doi trang thai EXPIRED
     * (bai bi tu nop khi het gio van giu nhan do); chi PENDING_REVIEW moi chuyen sang SUBMITTED.
     */
    static void recomputeFinalScore(ExamAttempt attempt, BigDecimal maxScore) {
        BigDecimal objective = attempt.getObjectiveScore() == null ? BigDecimal.ZERO : attempt.getObjectiveScore();
        boolean hasEssay = attempt.getQuestions().stream().anyMatch(q -> q.getType() == QuestionType.ESSAY);
        boolean codePending = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.CODING)
                .anyMatch(q -> {
                    ExamAttemptAnswer a = findAnswer(attempt, q);
                    return a == null || a.getScore() == null;
                });
        BigDecimal essayTotal = attempt.getQuestions().stream()
                .filter(q -> q.getType() == QuestionType.ESSAY)
                .map(q -> {
                    ExamAttemptAnswer a = findAnswer(attempt, q);
                    return a == null || a.getScore() == null ? BigDecimal.ZERO : a.getScore();
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        if (attempt.getFinalScore() != null) {
            attempt.setFinalScore(ExamScoring.clamp(
                    ExamScoring.applyPenalty(objective.add(essayTotal), attempt.getLatePenaltyPercentApplied()), maxScore));
        } else if (!hasEssay && !codePending) {
            attempt.setFinalScore(ExamScoring.clamp(
                    ExamScoring.applyPenalty(objective, attempt.getLatePenaltyPercentApplied()), maxScore));
            if (attempt.getStatus() == ExamAttemptStatus.PENDING_REVIEW) {
                attempt.setStatus(ExamAttemptStatus.SUBMITTED);
            }
        }
    }
}
