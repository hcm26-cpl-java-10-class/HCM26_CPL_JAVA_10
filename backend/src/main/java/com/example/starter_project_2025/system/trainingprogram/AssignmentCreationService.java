package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AssignmentCreationService {
    private final AssignmentClassCreation classes;
    private final AssignmentTrainerCreation trainers;
    private final ClassSetupService assignments;
    private final TeachingAssignmentSessionGuard guard;
    private final AssignmentSubjectCreation newSubjects;

    public record Request(
            @NotNull @Valid AssignmentClassCreation.Request classDetails,
            @NotNull @Valid AssignmentTrainerCreation.Request trainer,
            @Positive Long subjectId,
            @NotNull AssignmentRole role,
            @NotNull LocalDate effectiveFrom,
            LocalDate effectiveTo,
            @Valid AssignmentSubjectCreation.Request newSubject,
            @Valid @Size(min = 1, max = 200) List<@NotNull AssignmentTeachingSlot> teachingSlots) {
        public Request(AssignmentClassCreation.Request classDetails, AssignmentTrainerCreation.Request trainer,
                       Long subjectId, AssignmentRole role, LocalDate effectiveFrom, LocalDate effectiveTo,
                       AssignmentSubjectCreation.Request newSubject) {
            this(classDetails, trainer, subjectId, role, effectiveFrom, effectiveTo, newSubject, null);
        }
    }

    /** All writes join this transaction; any failed assignment validation rolls them all back. */
    @Transactional
    public TeachingAssignmentResponse create(Request request) {
        guard.lockForWrite();
        if ((request.subjectId() == null) == (request.newSubject() == null)) throw new BusinessValidationException(Map.of("newSubject.name",
                List.of("Provide either an existing subject or new subject details.")));
        var classDetails = request.classDetails();
        Long assignedId = request.subjectId();
        if (request.newSubject() != null) {
            var program = classDetails.newProgram();
            if (program == null) throw new BusinessValidationException(Map.of("newSubject.name",
                    List.of("Create a new program when adding a new subject.")));
            assignedId = newSubjects.create(newSubjects.resolveDuration(request.newSubject(), request.teachingSlots()));
            var subjectIds = new java.util.LinkedHashSet<Long>();
            subjectIds.add(assignedId); subjectIds.addAll(program.subjectIds());
            classDetails = new AssignmentClassCreation.Request(classDetails.name(), classDetails.programId(), classDetails.startDate(),
                    classDetails.endDate(), classDetails.plannedSize(), new AssignmentProgramCreation.Request(program.name(), program.version(), List.copyOf(subjectIds)));
        }
        final Long selectedId = assignedId;
        var clazz = classes.create(classDetails);
        var trainer = trainers.create(request.trainer());
        var curriculum = assignments.getAssignmentCreateContext(clazz.getId());
        var subject = curriculum.subjects().stream().filter(item -> item.subjectId().equals(selectedId))
                .findFirst().orElseThrow(() -> new BusinessValidationException(Map.of("subjectId",
                        List.of("Choose a subject included in this class training program."))));
        return assignments.createAssignment(new TeachingAssignmentRequest(clazz.getId(), subject.programSubjectId(),
                trainer.getId(), request.role(), request.effectiveFrom(), request.effectiveTo(), null, request.teachingSlots()));
    }
}
