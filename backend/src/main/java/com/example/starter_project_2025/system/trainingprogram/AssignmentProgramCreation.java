package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.subject.*;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;
import java.util.*;

@Service
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('PROGRAM_CREATE') and hasAuthority('PROGRAM_UPDATE')")
public class AssignmentProgramCreation {
    private final SubjectRepository subjects;
    private final TrainingProgramService service;
    private final TrainingProgramRepository programs;

    public record Request(@NotBlank @Size(max = 200) String name, @NotBlank @Size(max = 30) String version,
                          @NotNull @Size(max = 200) List<@NotNull @Positive Long> subjectIds) {}
    public record SubjectOption(Long id, String code, String name, String version, Integer durationHours) {}

    @Transactional(readOnly = true)
    public List<SubjectOption> subjectOptions() {
        return subjects.findByIsActiveTrue().stream().filter(s -> s.getStatus() == SubjectStatus.ACTIVE
                && s.getDurationHours() != null && s.getDurationHours() > 0)
                .map(s -> new SubjectOption(s.getId(), s.getCode(), s.getName(), s.getVersion(), s.getDurationHours())).toList();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public TrainingProgram create(Request request) {
        if (request.subjectIds().isEmpty() || request.subjectIds().size() > 200) throw invalid("Add between 1 and 200 subjects to the program.");
        if (new HashSet<>(request.subjectIds()).size() != request.subjectIds().size()) throw invalid("Do not repeat a subject.");
        var choices = subjects.findByIdInAndIsActiveTrue(request.subjectIds());
        if (choices.size() != request.subjectIds().size() || choices.stream().anyMatch(s -> s.getStatus() != SubjectStatus.ACTIVE
                || s.getDurationHours() == null || s.getDurationHours() <= 0)) throw invalid("Add active subjects with a valid duration.");
        var links = new ArrayList<ProgramSubjectRequest>();
        for (int index = 0; index < request.subjectIds().size(); index++) links.add(new ProgramSubjectRequest(request.subjectIds().get(index), index + 1));
        var created = service.create(new TrainingProgramRequest("TP_" + UUID.randomUUID().toString().replace("-", ""),
                request.name().strip(), request.version().strip(), null, links));
        service.activate(created.id());
        return programs.findById(created.id()).orElseThrow();
    }
    private BusinessValidationException invalid(String message) {
        return new BusinessValidationException(Map.of("newProgram.subjectIds", List.of(message)));
    }
}
