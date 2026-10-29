package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.external_api.*;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import jakarta.validation.constraints.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssignmentClassCreation {
    private final ManagedTeachingClassRepository classes;
    private final ManagedClassDirectory directory;
    private final ExternalApiService external;
    private final TrainingProgramRepository programs;
    private final ClassSetupService setup;
    private final TeachingAssignmentSessionGuard guard;
    private final AssignmentProgramCreation newPrograms;

    public record Request(@NotBlank @Size(max = 200) String name, @Positive Long programId,
                          @NotNull LocalDate startDate, @NotNull LocalDate endDate,
                          @NotNull @Min(1) @Max(10000) Integer plannedSize,
                          @jakarta.validation.Valid AssignmentProgramCreation.Request newProgram) {}

    @Transactional(readOnly = true)
    public List<ClassProgramSubjectsResponse.ProgramSummary> programOptions() {
        return programs.findAll().stream().filter(this::eligible)
                .map(p -> new ClassProgramSubjectsResponse.ProgramSummary(p.getId(), p.getCode(), p.getName(), p.getVersion(), p.getStatus()))
                .toList();
    }

    @Transactional
    public ExternalClassDTO create(Request request) {
        guard.lockForWrite();
        if (!request.startDate().isAfter(LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")))) {
            throw invalid("startDate", "Class start date must be tomorrow or later (Vietnam time).");
        }
        if (request.endDate().isBefore(request.startDate())) throw invalid("endDate", "Class end date must be on or after the start date.");
        if ((request.programId() == null) == (request.newProgram() == null)) throw invalid("programId", "Provide either an existing program or a new program with subjects.");
        var program = request.newProgram() != null ? newPrograms.create(request.newProgram())
                : programs.findById(request.programId()).filter(this::eligible)
                .orElseThrow(() -> invalid("programId", "Choose an active program with active subjects."));
        String name = request.name().strip().replaceAll("\\s+", " ");
        String normalized = normalize(name);
        var existing = external.fetchClasses(null);
        if (classes.existsByNormalizedName(normalized) || existing.stream().anyMatch(c -> normalized.equals(normalize(c.getName()))
                || normalized.equals(normalize(c.getCode())))) {
            throw new ConflictException("A class with this name or code already exists. Use that class or enter a different name.");
        }
        // A positive 52-bit identity is exactly representable in JavaScript. Check both
        // directories under the common write lock rather than assuming a reserved ID range.
        var ids = new HashSet<Long>();
        existing.forEach(c -> ids.add(c.getId()));
        long referenceId;
        do { referenceId = UUID.randomUUID().getMostSignificantBits() >>> 12; } while (referenceId == 0 || ids.contains(referenceId));
        var clazz = new ManagedTeachingClass();
        clazz.setReferenceId(referenceId); clazz.setName(name); clazz.setNormalizedName(normalized);
        clazz.setStartDate(request.startDate()); clazz.setEndDate(request.endDate()); clazz.setPlannedSize(request.plannedSize());
        classes.saveAndFlush(clazz);
        // Profile and program link commit together; failed curriculum validation leaves no class behind.
        setup.assignProgram(referenceId, program.getId());
        return directory.profile(clazz);
    }

    private boolean eligible(TrainingProgram program) {
        return Boolean.TRUE.equals(program.getIsActive()) && program.getStatus() == ProgramStatus.ACTIVE
                && program.getSubjects().stream().anyMatch(ps -> Boolean.TRUE.equals(ps.getSubject().getIsActive())
                && ps.getSubject().getStatus() == SubjectStatus.ACTIVE);
    }
    private String normalize(String value) {
        return Normalizer.normalize(Objects.toString(value, "").strip().replaceAll("\\s+", " "), Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
    }
    private BusinessValidationException invalid(String field, String message) {
        return new BusinessValidationException(Map.of(field, List.of(message)));
    }
}
