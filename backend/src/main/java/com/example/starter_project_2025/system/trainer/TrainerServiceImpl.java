package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.*;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class TrainerServiceImpl implements TrainerService {
    private final TrainerRepository repository;
    private final SubjectRepository subjects;
    private final TrainerMapper mapper;
    private final Validator validator;

    public Page<TrainerDTO> list(String search, String status, int page, int size) {
        if (page < 0 || size < 1 || size > 100) throw new BadRequestException("Page must be >= 0 and size between 1 and 100.");
        TrainerStatus filter = status == null || status.isBlank() || "all".equalsIgnoreCase(status) ? null : parseStatus(status);
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (needle.length() > 150) throw new BadRequestException("Search must not exceed 150 characters.");
        Specification<Trainer> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.isTrue(root.get("isActive")));
            if (filter != null) predicates.add(cb.equal(root.get("status"), filter));
            if (!needle.isEmpty()) {
                String like = "%" + needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("trainerCode")), like, '\\'),
                    cb.like(cb.lower(root.get("fullName")), like, '\\'), cb.like(cb.lower(root.get("email")), like, '\\'),
                    cb.like(cb.lower(root.get("specialization")), like, '\\')));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        return repository.findAll(spec, PageRequest.of(page, size, Sort.by("trainerCode").and(Sort.by("id")))).map(mapper::toDTO);
    }
    public TrainerDTO get(Long id) { return mapper.toDTO(require(id, false)); }
    @Transactional public TrainerDTO create(CreateTrainerRequest input) {
        Trainer t = new Trainer(); apply(t, normalize(input)); return save(t);
    }
    @Transactional public TrainerDTO update(Long id, UpdateTrainerRequest input) {
        Trainer t = require(id, true); apply(t, normalize(input.asCreate())); return save(t);
    }
    @Transactional public TrainerDTO changeStatus(Long id, TrainerStatus status) {
        if (status == null) throw new BadRequestException("Status is required.");
        Trainer t = require(id, true); t.setStatus(status); return save(t);
    }
    /** Archive only. Historical identities and assignments are never hard-deleted. */
    @Transactional public void delete(Long id) {
        Trainer t = require(id, true);
        if (repository.hasInternalAssignments(id) || repository.hasClasses(id))
            throw new ConflictException("Trainer is referenced by a class or teaching assignment. Set INACTIVE instead.");
        t.setIsActive(false); t.setStatus(TrainerStatus.INACTIVE); repository.saveAndFlush(t);
    }
    public List<TrainerDTO.Topic> topics() {
        return subjects.findByIsActiveTrue().stream().sorted(Comparator.comparing(Subject::getCode).thenComparing(Subject::getVersion))
            .map(s -> new TrainerDTO.Topic(s.getId(), s.getCode(), s.getName(), s.getVersion(), true)).toList();
    }
    Trainer require(Long id, boolean lock) {
        return (lock ? repository.findForUpdate(id) : repository.findByIdAndIsActiveTrue(id))
            .orElseThrow(() -> new ResourceNotFoundException("Trainer not found"));
    }
    CreateTrainerRequest normalize(CreateTrainerRequest r) {
        var normalized = new CreateTrainerRequest(trim(r.trainerCode()).toUpperCase(Locale.ROOT), trim(r.fullName()),
            trim(r.email()).toLowerCase(Locale.ROOT), trim(r.specialization()), r.status(), r.teachingTopicIds());
        var errors = new LinkedHashMap<String, List<String>>();
        validator.validate(normalized).forEach(v -> errors.computeIfAbsent(v.getPropertyPath().toString(), k -> new ArrayList<>()).add(v.getMessage()));
        if (!errors.isEmpty()) throw new BusinessValidationException(errors);
        return normalized;
    }
    private void apply(Trainer t, CreateTrainerRequest r) {
        Long excluded = t.getId() == null ? -1L : t.getId();
        if (repository.existsByTrainerCodeIgnoreCaseAndIdNot(r.trainerCode(), excluded)) throw new ConflictException("Trainer Code already exists (including archived trainers).");
        if (repository.existsByEmailIgnoreCaseAndIdNot(r.email(), excluded)) throw new ConflictException("Work Email already exists (including archived trainers).");
        Set<Long> ids = r.teachingTopicIds() == null ? Set.of() : r.teachingTopicIds();
        var resolved = subjects.findByIdInAndIsActiveTrue(ids);
        // Preserve a saved inactive topic on edit, but never add a new inactive/missing topic.
        var allowed = new LinkedHashMap<Long, Subject>();
        resolved.forEach(s -> allowed.put(s.getId(), s));
        t.getTeachingTopics().stream().filter(s -> ids.contains(s.getId())).forEach(s -> allowed.putIfAbsent(s.getId(), s));
        if (allowed.size() != ids.size()) throw new BadRequestException("Teaching Topics must reference existing ACTIVE topics.");
        t.setTrainerCode(r.trainerCode()); t.setFullName(r.fullName()); t.setEmail(r.email());
        t.setSpecialization(r.specialization()); t.setStatus(r.status()); t.setTeachingTopics(new LinkedHashSet<>(allowed.values()));
    }
    private TrainerDTO save(Trainer t) {
        try { return mapper.toDTO(repository.saveAndFlush(t)); }
        catch (DataIntegrityViolationException ex) { throw new ConflictException("Trainer Code or Work Email already exists."); }
    }
    static String trim(String s) { return s == null ? "" : s.trim(); }
    static TrainerStatus parseStatus(String status) {
        try { return TrainerStatus.valueOf(status.trim().toUpperCase(Locale.ROOT)); }
        catch (IllegalArgumentException ex) { throw new BadRequestException("Status must be ACTIVE or INACTIVE."); }
    }
}
