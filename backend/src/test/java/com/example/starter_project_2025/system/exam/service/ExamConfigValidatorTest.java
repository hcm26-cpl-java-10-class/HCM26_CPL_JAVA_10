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

    @Test
    void rejectsStartTimeInThePast() {
        ExamDTO request = new ExamDTO();
        request.setStartTime(java.time.LocalDateTime.now().minusHours(2));
        ValidationContext context = new ValidationContext();

        validator.validate(null, request, 10, context);

        assertThrows(BusinessValidationException.class, context::throwIfErrors);
    }

    @Test
    void acceptsStartTimeInTheFuture() {
        ExamDTO request = new ExamDTO();
        request.setStartTime(java.time.LocalDateTime.now().plusHours(2));
        request.setEndTime(java.time.LocalDateTime.now().plusHours(4));
        ValidationContext context = new ValidationContext();

        validator.validate(null, request, 10, context);

        context.throwIfErrors();
    }

    @Test
    void allowsUnchangedPastStartTimeWhenUpdatingExam() {
        java.time.LocalDateTime pastTime = java.time.LocalDateTime.now().minusHours(5);
        Exam existing = new Exam();
        existing.setStartTime(pastTime);

        ExamDTO request = new ExamDTO();
        request.setStartTime(pastTime); // unchanged
        ValidationContext context = new ValidationContext();

        validator.validate(existing, request, 10, context);

        context.throwIfErrors();
    }
}