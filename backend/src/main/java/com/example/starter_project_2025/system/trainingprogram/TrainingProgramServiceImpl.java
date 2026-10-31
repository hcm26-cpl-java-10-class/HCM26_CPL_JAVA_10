package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TrainingProgramServiceImpl implements TrainingProgramService {
    private final TrainingProgramRepository programRepository;
    private final SubjectRepository subjectRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final ClassTrainingProgramRepository classTrainingProgramRepository;

    @Override
    @Transactional(readOnly = true)
    public List<String> findRegions() { return programRepository.findDistinctRegions(); }

    @Override
    @Transactional(readOnly = true)
    public List<TrainingProgramResponse> findAll(String search, ProgramStatus status, String region) {
        String q = search == null ? "" : search.trim();
        String r = region == null ? "" : region.trim();
        return programRepository.searchAll(q, status, r).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<TrainingProgramResponse> findPage(String search, ProgramStatus status, String region, org.springframework.data.domain.Pageable pageable) {
        String q = search == null ? "" : search.trim();
        String r = region == null ? "" : region.trim();
        return programRepository.searchPage(q, status, r, pageable).map(this::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingProgramResponse findById(Long id) {
        return toResponse(getProgram(id));
    }

    @Override
    public TrainingProgramResponse create(TrainingProgramRequest request) {
        validateCodeVersion(request.code(), request.version(), null);
        if (request.subjects() == null || request.subjects().isEmpty()) {
            throw new IllegalArgumentException("A training program must contain at least one subject.");
        }
        TrainingProgram p = new TrainingProgram();
        p.setCode(request.code().trim());
        p.setName(request.name().trim());
        p.setVersion(request.version().trim());
        p.setRegion(trimToNull(request.region()));
        p.setStatus(ProgramStatus.ACTIVE);
        programRepository.save(p);
        applySubjects(p, request.subjects());
        validateProgramSubjects(p);
        p.setIsActive(true);
        return toResponse(programRepository.save(p));
    }

    @Override
    public TrainingProgramResponse update(Long id, TrainingProgramRequest request) {
        TrainingProgram p = getProgram(id);
        if (classTrainingProgramRepository.existsByProgram_Id(id)) {
            throw new ConflictException("This program version is assigned to a class. Clone a new version to make changes; existing classes must keep the old programId.");
        }
        validateCodeVersion(request.code(), request.version(), id);
        if (request.subjects() == null || request.subjects().isEmpty()) {
            throw new IllegalArgumentException("A training program must contain at least one subject.");
        }
        p.setCode(request.code().trim());
        p.setName(request.name().trim());
        p.setVersion(request.version().trim());
        p.setRegion(trimToNull(request.region()));
        if (request.subjects() != null) applySubjects(p, request.subjects());
        validateProgramSubjects(p);
        return toResponse(programRepository.save(p));
    }

    @Override
    public TrainingProgramResponse updateSubjects(Long id, List<ProgramSubjectRequest> subjects) {
        TrainingProgram p = getProgram(id);
        if (classTrainingProgramRepository.existsByProgram_Id(id)) {
            throw new ConflictException("This program version is assigned to a class. Clone a new version to change its subjects.");
        }
        applySubjects(p, subjects);
        validateProgramSubjects(p);
        return toResponse(programRepository.save(p));
    }

    @Override
    public TrainingProgramResponse cloneVersion(Long id, String newVersion) {
        TrainingProgram source = getProgram(id);
        if (newVersion == null || newVersion.isBlank()) throw new IllegalArgumentException("newVersion is required");
        validateCodeVersion(source.getCode(), newVersion.trim(), null);
        TrainingProgram copy = new TrainingProgram();
        copy.setCode(source.getCode());
        copy.setName(source.getName());
        copy.setVersion(newVersion.trim());
        copy.setRegion(source.getRegion());
        copy.setStatus(ProgramStatus.ACTIVE);
        programRepository.save(copy);
        List<ProgramSubjectRequest> requests = source.getSubjects().stream()
                .map(ps -> new ProgramSubjectRequest(ps.getSubject().getId(), ps.getOrderIndex())).toList();
        applySubjects(copy, requests);
        validateProgramSubjects(copy);
        copy.setIsActive(true);
        return toResponse(programRepository.save(copy));
    }

    @Override
    public TrainingProgramResponse activate(Long id) {
        TrainingProgram p = getProgram(id);
        if (p.getSubjects().isEmpty()) throw new IllegalArgumentException("Cannot activate a program without subjects.");
        for (ProgramSubject ps : p.getSubjects()) {
            Subject subject = ps.getSubject();
            if (!Boolean.TRUE.equals(subject.getIsActive())) {
                throw new IllegalArgumentException("Subject " + subject.getCode() + " is inactive.");
            }
            if (subject.getDurationHours() == null || subject.getDurationHours() <= 0) {
                throw new IllegalArgumentException("Subject " + subject.getCode() + " must have durationHours greater than 0.");
            }
        }
        p.setStatus(ProgramStatus.ACTIVE);
        p.setIsActive(true);
        return toResponse(programRepository.save(p));
    }

    @Override
    public TrainingProgramResponse changeStatus(Long id, ProgramStatus status) {
        TrainingProgram p = getProgram(id);
        if (status == null) throw new IllegalArgumentException("status is required");
        if (status == ProgramStatus.ACTIVE) return activate(id);
        p.setStatus(ProgramStatus.INACTIVE);
        p.setIsActive(false);
        return toResponse(programRepository.save(p));
    }

    private void applySubjects(TrainingProgram program, List<ProgramSubjectRequest> requests) {
        if (requests == null) requests = List.of();
        Set<Long> ids = new HashSet<>();
        Set<Integer> orderIndexes = new HashSet<>();
        List<ProgramSubject> links = new ArrayList<>();
        Map<Long, ProgramSubject> existingBySubjectId = new HashMap<>();
        for (ProgramSubject existing : program.getSubjects()) {
            existingBySubjectId.put(existing.getSubject().getId(), existing);
            if (teachingAssignmentRepository.existsByProgramSubject_Id(existing.getId())) {
                ProgramSubjectRequest replacement = requests.stream()
                        .filter(request -> request != null
                                && Objects.equals(request.subjectId(), existing.getSubject().getId()))
                        .findFirst()
                        .orElse(null);
                if (replacement == null || !Objects.equals(replacement.orderIndex(), existing.getOrderIndex())) {
                    throw new ConflictException("A program subject referenced by a teaching assignment cannot be removed or reordered.");
                }
            }
        }
        if (requests.isEmpty()) throw new IllegalArgumentException("A training program must contain at least one subject.");
        for (ProgramSubjectRequest req : requests) {
            if (req == null || req.subjectId() == null || req.orderIndex() == null || req.orderIndex() <= 0)
                throw new IllegalArgumentException("Each subject requires a valid subjectId and positive orderIndex.");
            if (!ids.add(req.subjectId())) throw new IllegalArgumentException("Duplicate subjectId: " + req.subjectId());
            if (!orderIndexes.add(req.orderIndex())) throw new IllegalArgumentException("Duplicate orderIndex: " + req.orderIndex());
            Subject subject = subjectRepository.findById(req.subjectId())
                    .orElseThrow(() -> new ResourceNotFoundException("Subject not found with ID: " + req.subjectId()));
            if (!Boolean.TRUE.equals(subject.getIsActive())) throw new IllegalArgumentException("Subject is inactive: " + subject.getId());
            if (subject.getDurationHours() == null || subject.getDurationHours() <= 0)
                throw new IllegalArgumentException("Subject durationHours must be greater than 0: " + subject.getId());
            ProgramSubject link = existingBySubjectId.get(req.subjectId());
            if (link == null) link = new ProgramSubject();
            link.setSubject(subject);
            link.setProgram(program);
            link.setOrderIndex(req.orderIndex());
            links.add(link);
        }
        if (orderIndexes.size() != requests.size()) throw new IllegalArgumentException("Subject order must be continuous from 1 to N.");
        for (int expected = 1; expected <= requests.size(); expected++) {
            if (!orderIndexes.contains(expected)) throw new IllegalArgumentException("Subject order must be continuous from 1 to N.");
        }
        Set<Long> retainedSubjectIds = links.stream().map(link -> link.getSubject().getId()).collect(Collectors.toSet());
        program.getSubjects().removeIf(existing -> !retainedSubjectIds.contains(existing.getSubject().getId()));
        Map<Long, ProgramSubject> current = program.getSubjects().stream()
                .collect(Collectors.toMap(item -> item.getSubject().getId(), item -> item));
        for (ProgramSubject requested : links) {
            ProgramSubject existing = current.get(requested.getSubject().getId());
            if (existing == null) {
                requested.setProgram(program);
                program.getSubjects().add(requested);
            } else {
                existing.setOrderIndex(requested.getOrderIndex());
                existing.setSubject(requested.getSubject());
            }
        }
    }

    private void validateCodeVersion(String code, String version, Long currentId) {
        boolean exists = programRepository.findAll().stream()
                .filter(p -> !Objects.equals(p.getId(), currentId))
                .anyMatch(p -> p.getCode() != null && p.getVersion() != null
                        && p.getCode().trim().equalsIgnoreCase(code.trim())
                        && p.getVersion().trim().equalsIgnoreCase(version.trim()));
        if (exists) throw new IllegalArgumentException("A program with this code and version already exists.");
    }

    private TrainingProgram getProgram(Long id) {
        return programRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Training program not found with ID: " + id));
    }

    private TrainingProgramResponse toResponse(TrainingProgram p) {
        List<TrainingProgramResponse.ProgramSubjectResponse> subjects = p.getSubjects().stream()
                .sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                .map(ps -> new TrainingProgramResponse.ProgramSubjectResponse(
                        ps.getId(), ps.getSubject().getId(), ps.getSubject().getCode(), ps.getSubject().getName(),
                        ps.getSubject().getVersion(), ps.getSubject().getDurationHours(), ps.getOrderIndex()))
                .toList();
        int total = subjects.stream().mapToInt(s -> s.durationHours() == null ? 0 : s.durationHours()).sum();
        return new TrainingProgramResponse(p.getId(), p.getCode(), p.getName(), p.getVersion(), p.getRegion(),
                p.getStatus(), p.getIsActive(), subjects, total);
    }

    private String trimToNull(String value) { return value == null || value.isBlank() ? null : value.trim(); }

    private void validateProgramSubjects(TrainingProgram program) {
        if (program.getSubjects() == null || program.getSubjects().isEmpty())
            throw new IllegalArgumentException("A training program must contain at least one subject.");
        for (ProgramSubject link : program.getSubjects()) {
            Subject subject = link.getSubject();
            if (!Boolean.TRUE.equals(subject.getIsActive()))
                throw new IllegalArgumentException("Subject " + subject.getCode() + " is inactive.");
            if (subject.getDurationHours() == null || subject.getDurationHours() <= 0)
                throw new IllegalArgumentException("Subject " + subject.getCode() + " must have positive duration.");
        }
    }

    @Override
    public void delete(Long id) {
        TrainingProgram program = getProgram(id);
        if (classTrainingProgramRepository.existsByProgram_Id(id))
            throw new ConflictException("Cannot delete a program assigned to a class. Set it INACTIVE instead.");
        if (program.getSubjects().stream().anyMatch(ps -> teachingAssignmentRepository.existsByProgramSubject_Id(ps.getId())))
            throw new ConflictException("Cannot delete a program referenced by teaching assignments. Set it INACTIVE instead.");
        programRepository.delete(program);
    }
}
