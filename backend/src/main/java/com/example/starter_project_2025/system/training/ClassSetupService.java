package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.*;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;

/** Class identity always comes from TrainingClass, never the shared class directory. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ClassSetupService {
    private final TrainingClassRepository classes;
    private final TrainingProgramRepository programs;
    private final ClassTrainingProgramRepository links;
    private final ProgramSubjectRepository subjects;
    private final TeachingAssignmentRepository assignments;
    private final ExternalApiService directory;

    public record ProgramLink(Long id, Long programId, String code, String name, String version,
                              ProgramStatus status, boolean active, boolean matchesClassProgram) {}
    public record SubjectOption(Long id, Long subjectId, String code, String name, boolean eligible) {}
    public record Setup(Long classId, String classCode, String savedProgram, String masterTrainer,
                        LocalDate startDate, LocalDate endDate, ProgramLink programLink,
                        List<SubjectOption> subjects, List<TeachingAssignmentResponse> assignments) {}

    public Setup get(Long classId) {
        var cls = requireClass(classId, false);
        var link = links.findByClassId(classId).filter(l -> Boolean.TRUE.equals(l.getIsActive()));
        var options = link.map(l -> subjects.findByProgram_IdOrderByOrderIndexAsc(l.getProgram().getId()).stream()
            .map(s -> new SubjectOption(s.getId(), s.getSubject().getId(), s.resolveCode(), s.resolveName(), eligible(s)))
            .toList()).orElse(List.of());
        return new Setup(cls.getId(), cls.getCode(), cls.getProgram(), cls.getMasterTrainer(), cls.getStartDate(), cls.getEndDate(),
            link.map(l -> view(l, cls)).orElse(null), options,
            assignments.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
                .filter(a -> Boolean.TRUE.equals(a.getIsActive())).map(a -> view(a, cls, null)).toList());
    }

    @Transactional
    public Setup link(Long classId, Long programId) {
        var cls = requireClass(classId, true);
        var program = activeProgram(programId);
        if (!matches(cls.getProgram(), program))
            throw new ConflictException("Saved Class Info Program '" + cls.getProgram() + "' does not match the selected program '"
                + program.getCode() + "'. Review the curriculum and explicitly correct Class Info first. No profile data was changed.");
        var link = links.findByClassId(classId).orElseGet(ClassTrainingProgram::new);
        if (link.getProgram() != null && !Objects.equals(link.getProgram().getId(), programId)
                && assignments.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream().anyMatch(a -> Boolean.TRUE.equals(a.getIsActive())))
            throw new ConflictException("Cannot replace the linked program while this class has active teaching assignments.");
        link.setClassId(classId); link.setProgram(program); link.setIsActive(true);
        links.saveAndFlush(link); // one row per class; repeated PUT is idempotent
        return get(classId);
    }

    @Transactional
    public TeachingAssignmentResponse saveAssignment(Long classId, Long assignmentId, TeachingAssignmentRequest input) {
        var cls = requireClass(classId, true); // serialize all setup writes for this class
        if (!Objects.equals(classId, input.classId())) throw new BadRequestException("Body Class ID must match the internal Class ID in the URL.");
        var assignment = assignmentId == null ? new TeachingAssignment() : assignments.findById(assignmentId)
            .filter(a -> Objects.equals(a.getClassId(), classId) && Boolean.TRUE.equals(a.getIsActive()))
            .orElseThrow(() -> new ResourceNotFoundException("Teaching assignment not found for this internal class"));
        var link = links.findByClassId(classId).filter(l -> Boolean.TRUE.equals(l.getIsActive()))
            .orElseThrow(() -> new ConflictException("Link an active training program to this internal class first."));
        var program = activeProgram(link.getProgram().getId());
        if (!matches(cls.getProgram(), program)) throw new ConflictException("Class Info Program no longer matches its linked program. Review Class Info before assigning a trainer.");
        var subject = subjects.findById(input.programSubjectId())
            .filter(s -> Objects.equals(s.getProgram().getId(), program.getId()) && eligible(s))
            .orElseThrow(() -> new BadRequestException("Program Subject must be an active subject of this class's linked program."));
        if (input.role() != AssignmentRole.MAIN) throw new BadRequestException("Class Setup manages MAIN teaching assignments only.");
        if (input.effectiveFrom().isAfter(cls.getStartDate())
                || (input.effectiveTo() != null && (input.effectiveTo().isBefore(cls.getEndDate()) || input.effectiveTo().isBefore(input.effectiveFrom()))))
            throw new BadRequestException("MAIN assignment dates must cover the entire class date range; Effective To may be open-ended.");
        var existing = assignments.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
            .filter(a -> Boolean.TRUE.equals(a.getIsActive()) && !Objects.equals(a.getId(), assignmentId))
            .filter(a -> Objects.equals(a.getProgramSubject().getId(), subject.getId()))
            .filter(a -> (input.effectiveTo() == null || !a.getEffectiveFrom().isAfter(input.effectiveTo()))
                && (a.getEffectiveTo() == null || !a.getEffectiveTo().isBefore(input.effectiveFrom())))
            .anyMatch(a -> a.getRole() == AssignmentRole.MAIN || Objects.equals(a.getTrainerId(), input.trainerId()));
        if (existing) throw new ConflictException("An overlapping MAIN or duplicate trainer assignment already exists for this class and Program Subject. Update that assignment instead.");
        var trainer = verifyTrainer(input.trainerId());
        if (!same(cls.getMasterTrainer(), trainer.getName()) && !same(cls.getMasterTrainer(), trainer.getEmail()))
            throw new ConflictException("Selected trainer does not match Master Trainer in Class Info. Review and explicitly update Class Info first.");
        assignment.setClassId(classId); assignment.setProgramSubject(subject); assignment.setTrainerId(trainer.getId());
        assignment.setRole(AssignmentRole.MAIN); assignment.setEffectiveFrom(input.effectiveFrom()); assignment.setEffectiveTo(input.effectiveTo());
        assignments.saveAndFlush(assignment);
        return view(assignment, cls, trainer.getName());
    }

    private ExternalTrainerDTO verifyTrainer(Long trainerId) {
        if (directory.isSampleData()) throw blocked("Trainer directory is configured as sample/unverified. Configure the real Master API; sample trainers cannot be assigned.");
        List<ExternalTrainerDTO> result;
        try { result = directory.fetchTrainers("active"); }
        catch (ExternalApiException ex) {
            throw blocked("Master Trainer API is unavailable" + (ex.getStatusCode() > 0 ? " (upstream HTTP " + ex.getStatusCode() + ")" : " (connection or response failure)") + ". No assignment was saved.");
        }
        if (directory.isSampleData()) throw blocked("Master Trainer API returned sample data. No assignment was saved.");
        var matching = result.stream().filter(Objects::nonNull).filter(t -> Objects.equals(t.getId(), trainerId)).toList();
        if (matching.size() != 1 || !"active".equalsIgnoreCase(matching.getFirst().getStatus())
                || matching.getFirst().getName() == null || matching.getFirst().getName().isBlank())
            throw new BadRequestException("Trainer ID must uniquely identify an active trainer in the real master directory.");
        return matching.getFirst();
    }

    private ExternalApiException blocked(String reason) { return new ExternalApiException("BLOCKED: " + reason, 503, null); }
    private TrainingProgram activeProgram(Long id) {
        var p = programs.findForClassSetup(id).filter(pgm -> Boolean.TRUE.equals(pgm.getIsActive()) && pgm.getStatus() == ProgramStatus.ACTIVE)
            .orElseThrow(() -> new BadRequestException("Select an ACTIVE, non-deleted Training Program."));
        if (subjects.findByProgram_IdOrderByOrderIndexAsc(p.getId()).stream().noneMatch(this::eligible))
            throw new BadRequestException("Selected program has no eligible active subjects. Configure its subjects first.");
        return p;
    }
    private TrainingClass requireClass(Long id, boolean lock) {
        return (lock ? classes.findForUpdate(id) : classes.findByIdAndIsActiveTrue(id))
            .orElseThrow(() -> new ResourceNotFoundException("Internal training class not found. Shared Class IDs cannot be used in Class Setup."));
    }
    private boolean eligible(ProgramSubject s) {
        return s.getSubject() != null && Boolean.TRUE.equals(s.getSubject().getIsActive()) && s.getSubject().getStatus() == SubjectStatus.ACTIVE;
    }
    private boolean matches(String text, TrainingProgram p) { return same(text, p.getCode()) || same(text, p.getName()); }
    private boolean same(String a, String b) { return a != null && b != null && a.trim().equalsIgnoreCase(b.trim()); }
    private ProgramLink view(ClassTrainingProgram l, TrainingClass cls) {
        var p = l.getProgram();
        return new ProgramLink(l.getId(), p.getId(), p.getCode(), p.getName(), p.getVersion(), p.getStatus(), Boolean.TRUE.equals(p.getIsActive()), matches(cls.getProgram(), p));
    }
    private TeachingAssignmentResponse view(TeachingAssignment a, TrainingClass cls, String trainerName) {
        var ps = a.getProgramSubject();
        return new TeachingAssignmentResponse(a.getId(), cls.getId(), cls.getCode(), ps.getId(), ps.getSubject().getId(),
            ps.resolveCode(), ps.resolveName(), a.getTrainerId(), trainerName, a.getRole(), a.getEffectiveFrom(), a.getEffectiveTo());
    }
}
