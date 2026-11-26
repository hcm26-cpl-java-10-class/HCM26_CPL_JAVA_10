package com.example.starter_project_2025.system.trainer;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.validation.Validator;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class TrainerServiceImpl implements TrainerService {

    TrainerRepository trainerRepository;
    SubjectRepository subjectRepository;
    TrainerMapper trainerMapper;
    Validator validator;

    @Override
    public Page<TrainerDTO> list(String search, String status, Long topicId, int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BadRequestException("Page must be >= 0 and size between 1 and 100.");
        }
        if (topicId != null && topicId <= 0) {
            throw new BadRequestException("Subject filter must be a positive ID.");
        }

        TrainerStatus statusFilter = (status == null || status.isBlank() || "all".equalsIgnoreCase(status))
                ? null
                : parseStatus(status);
        String needle = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (needle.length() > 150) {
            throw new BadRequestException("Search must not exceed 150 characters.");
        }

        Specification<Trainer> spec = buildFilterSpec(needle, statusFilter, topicId);
        PageRequest pageable = PageRequest.of(page, size, Sort.by("trainerCode").and(Sort.by("id")));
        Page<Trainer> trainers = trainerRepository.findAll(spec, pageable);
        Map<Long, TrainerDTO.Workload> workloads = loadWorkloads(
                trainers.getContent().stream().map(Trainer::getId).toList()
        );
        return trainers.map(t -> trainerMapper.toDTO(
                t,
                List.of(),
                workloads.getOrDefault(t.getId(), TrainerDTO.Workload.EMPTY)
        ));
    }

    @Override
    public TrainerDTO get(Long id) {
        Trainer trainer = require(id, false);
        TrainerDTO.Workload workload = loadWorkloads(List.of(trainer.getId()))
                .getOrDefault(trainer.getId(), TrainerDTO.Workload.EMPTY);
        return trainerMapper.toDTO(trainer, trainerRepository.findTeachingHistory(trainer.getId()), workload);
    }

    @Override
    @Transactional
    public TrainerDTO create(CreateTrainerRequest input) {
        CreateTrainerRequest normalized = normalize(input);
        ensureUniqueIdentity(normalized.trainerCode(), normalized.email(), -1L);
        Collection<Subject> resolvedTopics = resolveTeachingTopics(null, normalized.teachingTopicIds());

        Trainer trainer = Trainer.create(
                normalized.trainerCode(),
                normalized.fullName(),
                normalized.email(),
                normalized.specialization(),
                normalized.status(),
                resolvedTopics
        );
        return save(trainer);
    }

    @Override
    @Transactional
    public TrainerDTO update(Long id, UpdateTrainerRequest input) {
        Trainer trainer = require(id, true);
        CreateTrainerRequest normalized = normalize(input.asCreate());
        ensureUniqueIdentity(normalized.trainerCode(), normalized.email(), trainer.getId());
        Collection<Subject> resolvedTopics = resolveTeachingTopics(trainer, normalized.teachingTopicIds());

        trainer.updateProfile(
                normalized.trainerCode(),
                normalized.fullName(),
                normalized.email(),
                normalized.specialization(),
                normalized.status(),
                resolvedTopics
        );
        return save(trainer);
    }

    @Override
    @Transactional
    public TrainerDTO changeStatus(Long id, TrainerStatus status) {
        if (status == null) {
            throw new BadRequestException("Status is required.");
        }
        Trainer trainer = require(id, true);
        trainer.changeStatus(status);
        return save(trainer);
    }

    @Override
    @Transactional
    public int bulkChangeStatus(Set<Long> ids, TrainerStatus status) {
        if (ids == null || ids.isEmpty()) {
            throw new BadRequestException("At least one trainer ID is required.");
        }
        if (ids.size() > 100) {
            throw new BadRequestException("Cannot update more than 100 trainers at once.");
        }
        if (status == null) {
            throw new BadRequestException("Status is required.");
        }
        List<Long> orderedIds = ids.stream().sorted().toList();
        int updated = 0;
        for (Long id : orderedIds) {
            Trainer trainer = require(id, true);
            trainer.changeStatus(status);
            trainerRepository.save(trainer);
            updated++;
        }
        trainerRepository.flush();
        return updated;
    }

    /** Archive only. Historical identities and assignments are never hard-deleted. */
    @Override
    @Transactional
    public void delete(Long id) {
        Trainer trainer = require(id, true);
        if (trainerRepository.hasInternalAssignments(id) || trainerRepository.hasClasses(id)) {
            throw new ConflictException("Trainer is referenced by a class or teaching assignment. Set INACTIVE instead.");
        }
        trainer.archive();
        trainerRepository.saveAndFlush(trainer);
    }

    @Override
    public List<TrainerDTO.Topic> topics() {
        return subjectRepository.findByIsActiveTrue().stream()
                .sorted(Comparator.comparing(Subject::getCode).thenComparing(Subject::getVersion))
                .map(s -> new TrainerDTO.Topic(s.getId(), s.getCode(), s.getName(), s.getVersion(), true))
                .toList();
    }

    Trainer require(Long id, boolean lock) {
        Optional<Trainer> found = lock
                ? trainerRepository.findForUpdate(id)
                : trainerRepository.findByIdAndIsActiveTrue(id);
        return found.orElseThrow(() -> new ResourceNotFoundException("Trainer not found"));
    }

    CreateTrainerRequest normalize(CreateTrainerRequest request) {
        CreateTrainerRequest normalized = new CreateTrainerRequest(
                trim(request.trainerCode()).toUpperCase(Locale.ROOT),
                trim(request.fullName()),
                trim(request.email()).toLowerCase(Locale.ROOT),
                trim(request.specialization()),
                request.status(),
                request.teachingTopicIds()
        );

        Map<String, List<String>> errors = new LinkedHashMap<>();
        validator.validate(normalized).forEach(v ->
                errors.computeIfAbsent(v.getPropertyPath().toString(), k -> new ArrayList<>()).add(v.getMessage())
        );
        if (!errors.isEmpty()) {
            throw new BusinessValidationException(errors);
        }
        return normalized;
    }

    private Specification<Trainer> buildFilterSpec(String needle, TrainerStatus statusFilter, Long topicId) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.isTrue(root.get("isActive")));
            if (statusFilter != null) {
                predicates.add(cb.equal(root.get("status"), statusFilter));
            }
            if (topicId != null) {
                Join<Trainer, Subject> topicJoin = root.join("teachingTopics");
                predicates.add(cb.equal(topicJoin.get("id"), topicId));
                if (query != null) {
                    query.distinct(true);
                }
            }
            if (!needle.isEmpty()) {
                String like = "%" + needle
                        .replace("\\", "\\\\")
                        .replace("%", "\\%")
                        .replace("_", "\\_") + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("trainerCode")), like, '\\'),
                        cb.like(cb.lower(root.get("fullName")), like, '\\'),
                        cb.like(cb.lower(root.get("email")), like, '\\'),
                        cb.like(cb.lower(root.get("specialization")), like, '\\')
                ));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private Map<Long, TrainerDTO.Workload> loadWorkloads(Collection<Long> trainerIds) {
        if (trainerIds == null || trainerIds.isEmpty()) {
            return Map.of();
        }
        LocalDate monday = LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDateTime weekStart = monday.atStartOfDay();
        LocalDateTime weekEnd = monday.plusWeeks(1).atStartOfDay();

        Map<Long, Long> weeklySessions = new HashMap<>();
        for (Object[] row : trainerRepository.countScheduledSessionsInRange(
                trainerIds, Session.SessionStatus.SCHEDULED, weekStart, weekEnd
        )) {
            if (row[0] instanceof Number idNum && row[1] instanceof Number countNum) {
                weeklySessions.put(idNum.longValue(), countNum.longValue());
            }
        }

        Map<Long, Long> activeClasses = new HashMap<>();
        for (Object[] row : trainerRepository.countActiveClasses(trainerIds)) {
            if (row[0] instanceof Number idNum && row[1] instanceof Number countNum) {
                activeClasses.put(idNum.longValue(), countNum.longValue());
            }
        }

        Map<Long, TrainerDTO.Workload> result = new HashMap<>();
        for (Long id : trainerIds) {
            result.put(id, new TrainerDTO.Workload(
                    weeklySessions.getOrDefault(id, 0L),
                    activeClasses.getOrDefault(id, 0L)
            ));
        }
        return result;
    }

    private void ensureUniqueIdentity(String trainerCode, String email, Long excludedId) {
        if (trainerRepository.existsByTrainerCodeIgnoreCaseAndIdNot(trainerCode, excludedId)) {
            throw new ConflictException("Trainer Code already exists (including archived trainers).");
        }
        if (trainerRepository.existsByEmailIgnoreCaseAndIdNot(email, excludedId)) {
            throw new ConflictException("Work Email already exists (including archived trainers).");
        }
    }

    private Collection<Subject> resolveTeachingTopics(Trainer existing, Set<Long> requestedIds) {
        Set<Long> ids = requestedIds == null ? Set.of() : requestedIds;
        Map<Long, Subject> allowed = new LinkedHashMap<>();
        subjectRepository.findByIdInAndIsActiveTrue(ids).forEach(s -> allowed.put(s.getId(), s));

        // Preserve a saved inactive topic on edit, but never add a new inactive/missing topic.
        if (existing != null) {
            existing.getTeachingTopics().stream()
                    .filter(s -> ids.contains(s.getId()))
                    .forEach(s -> allowed.putIfAbsent(s.getId(), s));
        }

        if (allowed.size() != ids.size()) {
            throw new BadRequestException("Teaching Topics must reference existing ACTIVE topics.");
        }
        return allowed.values();
    }

    private TrainerDTO save(Trainer trainer) {
        try {
            return trainerMapper.toDTO(trainerRepository.saveAndFlush(trainer));
        } catch (DataIntegrityViolationException ex) {
            throw new ConflictException("Trainer Code or Work Email already exists.");
        }
    }

    static String trim(String value) {
        return value == null ? "" : value.trim();
    }

    static TrainerStatus parseStatus(String status) {
        try {
            return TrainerStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Status must be ACTIVE or INACTIVE.");
        }
    }
}
