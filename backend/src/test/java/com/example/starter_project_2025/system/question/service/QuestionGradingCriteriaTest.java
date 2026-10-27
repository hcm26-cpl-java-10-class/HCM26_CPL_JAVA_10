package com.example.starter_project_2025.system.question.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.question.domain.QuestionType;
import com.example.starter_project_2025.system.question.dto.QuestionDTO;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class QuestionGradingCriteriaTest {

    private final QuestionValidator validator = new QuestionValidator();

    @Test
    void essayCanBeCreatedWithoutGradingCriteria() {
        QuestionDTO question = new QuestionDTO();
        question.setType(QuestionType.ESSAY);

        ValidationContext context = new ValidationContext();
        validator.validateForCreate(question, context);

        assertFalse(context.hasErrors());
    }

    @Test
    void essayCriteriaMustHaveUniqueNamesAndTotalOneHundredPercent() {
        QuestionDTO question = new QuestionDTO();
        question.setType(QuestionType.ESSAY);
        question.setGradingCriteria(List.of(
                criterion("Correctness", 60),
                criterion("Explanation", 40)
        ));

        ValidationContext context = new ValidationContext();
        validator.validateForCreate(question, context);

        assertFalse(context.hasErrors());
    }

    @Test
    void essayCriteriaRejectInvalidTotalWeight() {
        QuestionDTO question = new QuestionDTO();
        question.setType(QuestionType.ESSAY);
        question.setGradingCriteria(List.of(
                criterion("Correctness", 60),
                criterion("Explanation", 30)
        ));

        ValidationContext context = new ValidationContext();
        validator.validateForCreate(question, context);

        assertTrue(context.hasErrors());
        assertTrue(context.getErrors().get("gradingCriteria").stream()
                .anyMatch(message -> message.contains("100%")));
    }

    private QuestionDTO.EssayCriterionDTO criterion(String name, int weight) {
        QuestionDTO.EssayCriterionDTO criterion = new QuestionDTO.EssayCriterionDTO();
        criterion.setName(name);
        criterion.setWeightPercentage(weight);
        return criterion;
    }
}
