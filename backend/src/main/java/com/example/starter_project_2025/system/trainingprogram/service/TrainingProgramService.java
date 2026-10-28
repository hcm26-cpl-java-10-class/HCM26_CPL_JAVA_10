package com.example.trainingprogram.service;

import com.example.trainingprogram.dto.*;
import com.example.trainingprogram.entity.ProgramStatus;
import com.example.trainingprogram.entity.TrainingProgram;
import com.example.trainingprogram.entity.TrainingProgramSubject;
import com.example.trainingprogram.exception.ConflictException;
import com.example.trainingprogram.exception.NotFoundException;
import com.example.trainingprogram.integration.SubjectGateway;
import com.example.trainingprogram.integration.TrainingProgramUsageChecker;
import com.example.trainingprogram.repository.TrainingProgramRepository;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import jakarta.persistence.criteria.Predicate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TrainingProgramService {
    private final TrainingProgramRepository repository;
    private final SubjectGateway subjectGateway;
    private final TrainingProgramUsageChecker usageChecker;

    public TrainingProgramService(
        TrainingProgramRepository repository,
        SubjectGateway subjectGateway,
        TrainingProgramUsageChecker usageChecker
    ) {
        this.repository = repository;
        this.subjectGateway = subjectGateway;
        this.usageChecker = usageChecker;
    }

    @Transactional(readOnly = true)
    public Page<TrainingProgramResponse> list(String search, String region, ProgramStatus status, Pageable pageable) {
        Specification<TrainingProgram> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                    cb.like(cb.lower(root.get("code")), pattern),
                    cb.like(cb.lower(root.get("name")), pattern),
                    cb.like(cb.lower(root.get("version")), pattern)
                ));
            }
            if (region != null && !region.isBlank()) {
                predicates.add(cb.equal(cb.lower(root.get("region")), region.trim().toLowerCase(Locale.ROOT)));
            }
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(new Predicate[0]));
        };
        return repository.findAll(spec, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public TrainingProgramResponse get(Long id) {
        return toResponse(findEntity(id));
    }

    @Transactional
    public TrainingProgramResponse create(TrainingProgramRequest request) {
        validateUnique(request.code(), request.version(), null);
        validateSubjects(request.subjects(), null);
        TrainingProgram program = new TrainingProgram();
        applyFields(program, request);
        applySubjects(program, request.subjects());
        return toResponse(repository.save(program));
    }

    @Transactional
    public TrainingProgramResponse update(Long id, TrainingProgramRequest request) {
        TrainingProgram program = findEntity(id);
        validateUnique(request.code(), request.version(), id);
        validateSubjects(request.subjects(), id);
        applyFields(program, request);
        applySubjects(program, request.subjects());
        return toResponse(repository.save(program));
    }

    @Transactional
    public TrainingProgramResponse changeStatus(Long id, ProgramStatus status) {
        TrainingProgram program = findEntity(id);
        if (status == ProgramStatus.ACTIVE) {
            if (program.getSubjects().isEmpty()) {
                throw new ConflictException("A program must contain at least one subject before activation.");
            }
            for (TrainingProgramSubject link : program.getSubjects()) {
                SubjectGateway.SubjectInfo subject = subjectGateway.findById(link.getSubjectId())
                    .orElseThrow(() -> new ConflictException("Subject " + link.getSubjectId() + " no longer exists."));
                if (!subject.active()) {
                    throw new ConflictException("Cannot activate program: subject " + subject.id() + " is inactive.");
                }
            }
        }
        program.setStatus(status);
        return toResponse(repository.save(program));
    }

    @Transactional
    public TrainingProgramResponse cloneProgram(Long id, String newVersion) {
        TrainingProgram source = findEntity(id);
        if (newVersion == null || newVersion.isBlank()) {
            throw new ConflictException("newVersion is required.");
        }
        validateUnique(source.getCode(), newVersion.trim(), null);

        TrainingProgram clone = new TrainingProgram();
        clone.setCode(source.getCode());
        clone.setName(source.getName());
        clone.setVersion(newVersion.trim());
        clone.setRegion(source.getRegion());
        clone.setStatus(ProgramStatus.DRAFT);

        List<TrainingProgramSubject> copied = source.getSubjects().stream()
            .sorted(Comparator.comparing(TrainingProgramSubject::getOrderIndex))
            .map(old -> {
                TrainingProgramSubject item = new TrainingProgramSubject();
                item.setSubjectId(old.getSubjectId());
                item.setSubjectCode(old.getSubjectCode());
                item.setSubjectName(old.getSubjectName());
                item.setDurationHours(old.getDurationHours());
                item.setOrderIndex(old.getOrderIndex());
                return item;
            }).toList();
        clone.replaceSubjects(copied);
        return toResponse(repository.save(clone));
    }

    @Transactional
    public void delete(Long id) {
        TrainingProgram program = findEntity(id);
        if (usageChecker.isUsedByAnyClass(id)) {
            throw new ConflictException("This program is assigned to classes; deactivate it instead of deleting it.");
        }
        repository.delete(program);
    }

    private TrainingProgram findEntity(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new NotFoundException("Training program not found: " + id));
    }

    private void validateUnique(String code, String version, Long exceptId) {
        boolean exists = exceptId == null
            ? repository.existsByCodeIgnoreCaseAndVersionIgnoreCase(code.trim(), version.trim())
            : repository.existsByCodeIgnoreCaseAndVersionIgnoreCaseAndIdNot(code.trim(), version.trim(), exceptId);
        if (exists) throw new ConflictException("Program code and version must be unique.");
    }

    private void validateSubjects(List<ProgramSubjectRequest> requests, Long ignoredProgramId) {
        if (requests == null || requests.isEmpty()) {
            throw new ConflictException("A training program must contain at least one subject.");
        }
        Set<Long> ids = new HashSet<>();
        Set<Integer> orders = new HashSet<>();
        for (ProgramSubjectRequest item : requests) {
            if (!ids.add(item.subjectId())) throw new ConflictException("Duplicate subject ID: " + item.subjectId());
            if (!orders.add(item.orderIndex())) throw new ConflictException("Duplicate orderIndex: " + item.orderIndex());
            SubjectGateway.SubjectInfo subject = subjectGateway.findById(item.subjectId())
                .orElseThrow(() -> new ConflictException("Subject not found: " + item.subjectId()));
            if (!subject.active()) throw new ConflictException("Subject is inactive: " + item.subjectId());
            if (subject.durationHours() == null || subject.durationHours() <= 0) {
                throw new ConflictException("Subject durationHours must be greater than zero: " + item.subjectId());
            }
        }
        // Enforce a continuous order sequence starting at 1.
        for (int expected = 1; expected <= requests.size(); expected++) {
            if (!orders.contains(expected)) {
                throw new ConflictException("Subject orderIndex values must be continuous from 1.");
            }
        }
    }

    private void applyFields(TrainingProgram program, TrainingProgramRequest request) {
        program.setCode(request.code().trim());
        program.setName(request.name().trim());
        program.setVersion(request.version().trim());
        program.setRegion(request.region() == null ? null : request.region().trim());
    }

    private void applySubjects(TrainingProgram program, List<ProgramSubjectRequest> requests) {
        List<TrainingProgramSubject> subjects = requests.stream()
            .sorted(Comparator.comparing(ProgramSubjectRequest::orderIndex))
            .map(request -> {
                SubjectGateway.SubjectInfo source = subjectGateway.findById(request.subjectId())
                    .orElseThrow(() -> new ConflictException("Subject not found: " + request.subjectId()));
                TrainingProgramSubject link = new TrainingProgramSubject();
                link.setSubjectId(source.id());
                link.setSubjectCode(source.code());
                link.setSubjectName(source.name());
                link.setDurationHours(source.durationHours());
                link.setOrderIndex(request.orderIndex());
                return link;
            }).collect(Collectors.toList());
        program.replaceSubjects(subjects);
    }

    private TrainingProgramResponse toResponse(TrainingProgram program) {
        List<TrainingProgramResponse.ProgramSubjectResponse> subjects = program.getSubjects().stream()
            .sorted(Comparator.comparing(TrainingProgramSubject::getOrderIndex))
            .map(s -> new TrainingProgramResponse.ProgramSubjectResponse(
                s.getSubjectId(), s.getSubjectCode(), s.getSubjectName(),
                s.getDurationHours(), s.getOrderIndex()
            )).toList();
        int hours = subjects.stream().mapToInt(TrainingProgramResponse.ProgramSubjectResponse::durationHours).sum();
        return new TrainingProgramResponse(
            program.getId(), program.getCode(), program.getName(), program.getVersion(),
            program.getRegion(), program.getStatus(), subjects.size(), hours, subjects,
            program.getCreatedAt(), program.getUpdatedAt()
        );
    }
}
