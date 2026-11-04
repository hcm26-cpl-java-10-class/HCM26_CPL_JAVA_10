package com.example.starter_project_2025.system.exam.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ExamCategoryTest {

    @Test
    void assessmentAndQuizShowAnswersByDefault() {
        assertTrue(ExamCategory.ASSESSMENT.isShowAnswersByDefault());
        assertTrue(ExamCategory.QUIZ.isShowAnswersByDefault());
    }

    @Test
    void midtermAndFinalTestHideAnswersByDefault() {
        assertFalse(ExamCategory.MIDTERM.isShowAnswersByDefault());
        assertFalse(ExamCategory.FINAL_TEST.isShowAnswersByDefault());
    }

    @Test
    void newExamDefaultsToAssessment() {
        assertEquals(ExamCategory.ASSESSMENT, new Exam().getCategory());
    }
}
