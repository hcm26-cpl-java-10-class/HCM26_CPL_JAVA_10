package com.example.starter_project_2025.system.schedule_validation;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;

import java.util.List;

public interface ScheduleValidationService {

    ScheduleValidationResult validate(SessionConflictCandidate candidate);

    ScheduleValidationResult validateBatch(List<SessionConflictCandidate> candidates);

    void addValidationErrors(SessionConflictCandidate candidate, ValidationContext context);
}
