package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Applies the same permissions and validation as creating all details through the form. */
@Service
@RequiredArgsConstructor
public class TeachingAssignmentDetailsImport {
    private final AssignmentCreationService creation;
    private final Validator validator;

    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE') and hasAuthority('CLASS_CREATE') and hasAuthority('CLASS_UPDATE_PROGRAM')"
            + " and hasAuthority('PROGRAM_CREATE') and hasAuthority('PROGRAM_UPDATE') and hasAuthority('TRAINER_CREATE')"
            + " and hasAuthority('SUBJECT_CREATE')")
    @Transactional(propagation = Propagation.MANDATORY)
    public TeachingAssignmentResponse create(AssignmentCreationService.Request request) {
        var violations = validator.validate(request);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        return creation.create(request);
    }
}
