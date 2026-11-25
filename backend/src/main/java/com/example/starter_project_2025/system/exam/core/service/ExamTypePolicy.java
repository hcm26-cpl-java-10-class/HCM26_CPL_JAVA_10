package com.example.starter_project_2025.system.exam.core.service;

import com.example.starter_project_2025.system.exam.core.domain.Exam;
import com.example.starter_project_2025.system.exam.core.domain.ExamType;
import com.example.starter_project_2025.system.question.core.domain.Question;
import com.example.starter_project_2025.system.question.core.domain.QuestionType;

import java.util.List;

public final class ExamTypePolicy {

    private ExamTypePolicy() {
    }

    public static ExamType effective(ExamType type) {
        return type == null ? ExamType.MULTIPLE_CHOICE : type;
    }

    public static ExamType determineEffective(Exam exam) {
        if (exam == null) {
            return ExamType.MULTIPLE_CHOICE;
        }
        if (exam.getExamType() != null) {
            return exam.getExamType();
        }
        if (exam.getQuestions() != null && !exam.getQuestions().isEmpty()) {
            boolean hasMc = exam.getQuestions().stream().anyMatch(q -> q.getType() == QuestionType.MULTIPLE_CHOICE);
            boolean hasCoding = exam.getQuestions().stream().anyMatch(q -> q.getType() == QuestionType.CODING);
            boolean hasEssay = exam.getQuestions().stream().anyMatch(q -> q.getType() == QuestionType.ESSAY);

            if (hasMc && !hasCoding && !hasEssay) return ExamType.MULTIPLE_CHOICE;
            if (hasCoding && !hasMc && !hasEssay) return ExamType.CODING;
            if (hasEssay && !hasMc && !hasCoding) return ExamType.ESSAY;
            if (hasMc && hasCoding && !hasEssay) return ExamType.MC_CODING;
            return ExamType.MIXED;
        }
        return ExamType.MULTIPLE_CHOICE;
    }

    public static List<QuestionType> allowedTypes(ExamType examType) {
        return switch (effective(examType)) {
            case MULTIPLE_CHOICE -> List.of(QuestionType.MULTIPLE_CHOICE);
            case CODING -> List.of(QuestionType.CODING);
            case ESSAY -> List.of(QuestionType.ESSAY);
            case MC_CODING -> List.of(QuestionType.MULTIPLE_CHOICE, QuestionType.CODING);
            case MIXED -> List.of(QuestionType.MULTIPLE_CHOICE, QuestionType.ESSAY, QuestionType.CODING);
        };
    }

    public static boolean allows(ExamType examType, QuestionType questionType) {
        return switch (effective(examType)) {
            case MIXED -> true;
            case MULTIPLE_CHOICE -> questionType == QuestionType.MULTIPLE_CHOICE;
            case ESSAY -> questionType == QuestionType.ESSAY;
            case CODING -> questionType == QuestionType.CODING;
            case MC_CODING -> questionType == QuestionType.MULTIPLE_CHOICE || questionType == QuestionType.CODING;
        };
    }

    public static String describe(ExamType examType) {
        return switch (effective(examType)) {
            case MIXED -> "cả trắc nghiệm, tự luận và lập trình";
            case MULTIPLE_CHOICE -> "chỉ trắc nghiệm";
            case ESSAY -> "chỉ tự luận";
            case CODING -> "chỉ lập trình";
            case MC_CODING -> "trắc nghiệm và lập trình";
        };
    }
}
