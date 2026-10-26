package com.example.starter_project_2025.system.exam.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class ExamCategoryTest {

    @Test
    void assessmentAndProgressTestShowAnswersByDefault() {
        assertTrue(ExamCategory.ASSESSMENT.isShowAnswersByDefault());
        assertTrue(ExamCategory.PROGRESS_TEST.isShowAnswersByDefault());
    }

    @Test
    void finalTestHidesAnswersByDefault() {
        assertFalse(ExamCategory.FINAL_TEST.isShowAnswersByDefault());
    }

    @Test
    void newExamDefaultsToAssessment() {
        assertEquals(ExamCategory.ASSESSMENT, new Exam().getCategory());
    }
}
