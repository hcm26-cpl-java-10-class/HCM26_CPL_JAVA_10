package com.example.starter_project_2025.system.exam.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.exam.domain.Exam;
import com.example.starter_project_2025.system.exam.domain.LatePolicy;
import com.example.starter_project_2025.system.exam.dto.ExamDTO;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;

class ExamConfigValidatorTest {

    private final ExamConfigValidator validator = new ExamConfigValidator();

    @Test
    void rejectsGracePeriodWhenLateSubmissionIsDisabled() {
        ExamDTO request = new ExamDTO();
        request.setLatePolicy(LatePolicy.NOT_ALLOWED);
        request.setLateGraceMinutes(15);
        ValidationContext context = new ValidationContext();

        validator.validate(new Exam(), request, 10, context);

        assertThrows(BusinessValidationException.class, context::throwIfErrors);
    }

    @Test
    void acceptsGracePeriodWhenLateSubmissionIsAllowed() {
        ExamDTO request = new ExamDTO();
        request.setLatePolicy(LatePolicy.ALLOWED);
        request.setEndTime(java.time.LocalDateTime.now().plusHours(1));
        request.setLateGraceMinutes(15);
        ValidationContext context = new ValidationContext();

        validator.validate(null, request, 10, context);

        context.throwIfErrors();
    }
}