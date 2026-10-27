package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.system.exam.domain.ExamType;
import com.example.starter_project_2025.system.question.domain.QuestionType;

public final class ExamTypePolicy {

    private ExamTypePolicy() {
    }

    public static ExamType effective(ExamType type) {
        return type == null ? ExamType.MIXED : type;
    }

    public static boolean allows(ExamType examType, QuestionType questionType) {
        return switch (effective(examType)) {
            case MIXED -> true;
            case MULTIPLE_CHOICE -> questionType == QuestionType.MULTIPLE_CHOICE;
            case ESSAY -> questionType == QuestionType.ESSAY;
        };
    }

    public static String describe(ExamType examType) {
        return switch (effective(examType)) {
            case MIXED -> "cả trắc nghiệm và tự luận";
            case MULTIPLE_CHOICE -> "chỉ trắc nghiệm";
            case ESSAY -> "chỉ tự luận";
        };
    }
}
