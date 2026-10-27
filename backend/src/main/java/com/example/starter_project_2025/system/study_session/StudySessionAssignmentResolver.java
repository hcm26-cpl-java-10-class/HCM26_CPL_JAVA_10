package com.example.starter_project_2025.system.study_session;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.trainingprogram.ClassSetupService;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignment;
import com.example.starter_project_2025.system.trainingprogram.TeachingAssignmentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Objects;

/** Verifies identity links and effective dates only; active eligibility remains unconfirmed. */
@Component
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class StudySessionAssignmentResolver {
    private final TeachingAssignmentRepository assignments;
    private final ClassSetupService classSetup;

    public record ResolvedAssignment(Long programSubjectId, Long trainerId) {}

    public ResolvedAssignment resolve(StudySessionDTO request, ValidationContext ctx) {
        if (request.getTeachingAssignmentId() == null || ctx.hasErrors()) return null;
        var assignment = assignments.findById(request.getTeachingAssignmentId()).orElse(null);
        if (assignment == null) {
            ctx.add("teachingAssignmentId", "Teaching assignment does not exist");
            return null;
        }
        checkActivePolicyPending(assignment);
        var ps = assignment.getProgramSubject();
        if (ps == null || ps.getId() == null || ps.getSubject() == null
                || ps.getSubject().getId() == null || ps.getProgram() == null
                || ps.getProgram().getId() == null || assignment.getTrainerId() == null
                || assignment.getClassId() == null || assignment.getEffectiveFrom() == null) {
            ctx.add("teachingAssignmentId", "Teaching assignment has incomplete reference data");
            return null;
        }
        if (!Objects.equals(request.getClassId(), assignment.getClassId()))
            ctx.add("classId", "Class ID must match the teaching assignment");
        if (!Objects.equals(request.getSubjectId(), ps.getSubject().getId()))
            ctx.add("subjectId", "Subject ID must match the assignment program subject");
        if (request.getProgramSubjectId() != null && !Objects.equals(request.getProgramSubjectId(), ps.getId()))
            ctx.add("programSubjectId", "Program subject ID must match the teaching assignment");
        if (request.getTrainerId() != null && !Objects.equals(request.getTrainerId(), assignment.getTrainerId()))
            ctx.add("trainerId", "Trainer ID must match the teaching assignment");
        if (request.getSessionDate() == null || request.getSessionDate().isBefore(assignment.getEffectiveFrom())
                || (assignment.getEffectiveTo() != null && request.getSessionDate().isAfter(assignment.getEffectiveTo())))
            ctx.add("sessionDate", "Session date must be within the teaching assignment effective dates");
        if (ctx.hasErrors()) return null;

        // Delegate to the official source: local class-program link takes precedence over
        // ExternalClassDTO.programId; the fallback must exist in TrainingProgramRepository.
        // Lookup failures propagate and prevent writes (including per-row import failures).
        var classProgram = classSetup.getClassProgramSubjects(assignment.getClassId());
        if (classProgram == null || !Objects.equals(classProgram.classId(), assignment.getClassId())
                || classProgram.program() == null || !Objects.equals(classProgram.program().id(), ps.getProgram().getId())) {
            ctx.add("programSubjectId", "Assignment program must match the program assigned to the class");
            return null;
        }
        return new ResolvedAssignment(ps.getId(), assignment.getTrainerId());
    }

    public ResolvedAssignment resolveUpdate(StudySession existing, StudySessionDTO changes, ValidationContext ctx) {
        return resolve(StudySessionDTO.builder()
                .teachingAssignmentId(changes.getTeachingAssignmentId() != null ? changes.getTeachingAssignmentId() : existing.getTeachingAssignmentId())
                .classId(changes.getClassId() != null ? changes.getClassId() : existing.getClassId())
                .subjectId(changes.getSubjectId() != null ? changes.getSubjectId() : existing.getSubjectId())
                .programSubjectId(changes.getProgramSubjectId() != null ? changes.getProgramSubjectId() : existing.getProgramSubjectId())
                .trainerId(changes.getTrainerId() != null ? changes.getTrainerId() : existing.getTrainerId())
                .sessionDate(changes.getSessionDate() != null ? changes.getSessionDate() : existing.getSessionDate())
                .build(), ctx);
    }

    public ResolvedAssignment resolveImport(StudySession session, ValidationContext ctx) {
        return resolveUpdate(session, new StudySessionDTO(), ctx);
    }

    private void checkActivePolicyPending(TeachingAssignment assignment) {
        // TODO(Tu): confirm active eligibility for assignment, class, trainer, subject and program,
        // including null semantics and whether current status or status on sessionDate applies.
        // Deliberately no active decision here. Successful resolution is NOT full business eligibility.
    }
}
