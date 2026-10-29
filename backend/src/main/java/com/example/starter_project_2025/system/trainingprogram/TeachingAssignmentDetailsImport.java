package com.example.starter_project_2025.system.trainingprogram;

import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Objects;

/** Applies the same permissions and validation as creating all details through the form. */
@Service
@RequiredArgsConstructor
public class TeachingAssignmentDetailsImport {
    private final AssignmentCreationService creation;
    private final Validator validator;
    private final ExternalApiService external;
    private final ClassSetupService assignments;
    private final AssignmentTrainerCreation trainers;
    private final ProgramSubjectRepository curriculum;
    private final TeachingAssignmentSessionGuard guard;
    private final AssignmentSubjectCreation newSubjects;

    @PreAuthorize("hasAuthority('ASSIGNMENT_CREATE') and hasAuthority('CLASS_CREATE') and hasAuthority('CLASS_UPDATE_PROGRAM')"
            + " and hasAuthority('PROGRAM_CREATE') and hasAuthority('PROGRAM_UPDATE') and hasAuthority('TRAINER_CREATE')"
            + " and hasAuthority('SUBJECT_CREATE')")
    @Transactional(propagation = Propagation.MANDATORY)
    public TeachingAssignmentResponse create(AssignmentCreationService.Request request) {
        var violations = validator.validate(request);
        if (!violations.isEmpty()) throw new ConstraintViolationException(violations);
        guard.lockForWrite();
        var details = request.classDetails();
        var matches = external.fetchClasses(null).stream()
                .filter(clazz -> normalize(clazz.getName()).equals(normalize(details.name()))
                        || normalize(clazz.getCode()).equals(normalize(details.name())))
                .toList();
        if (matches.isEmpty()) return creation.create(request);
        if (matches.size() != 1) throw new ConflictException("Multiple classes match this name. Use the ID-based import template.");
        var clazz = matches.get(0);
        if (!normalize(clazz.getName()).equals(normalize(details.name()))
                || !Objects.equals(clazz.getStartDate(), details.startDate().toString())
                || !Objects.equals(clazz.getEndDate(), details.endDate().toString())
                || !Objects.equals(clazz.getPlannedSize(), details.plannedSize())) {
            throw new ConflictException("The existing class has different name, dates or planned size. Match its details or use a new class name.");
        }
        var context = assignments.getAssignmentCreateContext(clazz.getId());
        var program = details.newProgram();
        if (program == null || context.program() == null
                || !normalize(context.program().name()).equals(normalize(program.name()))
                || !Objects.equals(context.program().version(), program.version().strip())) {
            throw new ConflictException("The existing class has a different program or version. Match its program details or use a new class name.");
        }
        if (request.newSubject() == null) throw new ConflictException("Provide subject details when importing class details.");
        var subject = newSubjects.resolveDuration(request.newSubject(), request.teachingSlots());
        var subjects = context.subjects().stream().filter(s -> normalize(s.name()).equals(normalize(subject.name()))).toList();
        if (subjects.size() != 1) throw new ConflictException("The subject is missing or ambiguous in the existing class program. Use the ID-based template or a new class name.");
        var link = curriculum.findById(subjects.get(0).programSubjectId()).orElseThrow();
        if (link.getSubject().getDurationHours().compareTo(subject.durationHours()) != 0) {
            throw new ConflictException("The existing subject has a different duration. Match its duration or use a new class name.");
        }
        var trainer = trainers.create(request.trainer());
        return assignments.createAssignment(new TeachingAssignmentRequest(clazz.getId(), link.getId(), trainer.getId(),
                request.role(), request.effectiveFrom(), request.effectiveTo(), null, request.teachingSlots()));
    }

    private String normalize(String value) {
        return Normalizer.normalize(Objects.toString(value, "").strip().replaceAll("\\s+", " "), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }
}
