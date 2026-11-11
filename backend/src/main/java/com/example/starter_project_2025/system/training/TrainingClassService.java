package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.exception.*;
import lombok.RequiredArgsConstructor;
import jakarta.validation.Validator;
import org.springframework.beans.BeanUtils;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDate;
import java.util.*;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TrainingClassService {
    private final TrainingClassRepository repository;
    private final SessionRepository sessions;
    private final Validator validator;
    private final ClassEnrollmentRepository enrollments;
    private static final Map<String, List<String>> TRANSITIONS = Map.of(
        "planning", List.of("assigned", "cancelled"),
        "assigned", List.of("active", "cancelled", "planning"),
        "active", List.of("completed", "cancelled"),
        "completed", List.of("closed"),
        "closed", List.of(), "cancelled", List.of()
    );
    public record ClassPage(List<TrainingClassDTO> content, long totalElements, int totalPages,
                            int number, int size, List<String> programs) {}

    public ClassPage list(int page, int size, String search, String status, String program,
                          LocalDate from, LocalDate to, String sort, String direction) {
        if (page < 0 || size < 1 || size > 100) throw new BadRequestException("Page must be >= 0 and size between 1 and 100");
        if (from != null && to != null && from.isAfter(to)) throw new BadRequestException("Invalid start date range");
        if (!Set.of("code", "program", "trainees", "startDate", "status", "name").contains(sort))
            throw new BadRequestException("Unsupported sort field");
        if (!Set.of("asc", "desc").contains(direction)) throw new BadRequestException("Unsupported sort direction");
        if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status) && !TRANSITIONS.containsKey(status))
            throw new BadRequestException("Unsupported class status");
        Specification<TrainingClass> spec = (root, query, cb) -> {
            var predicates = new ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.isTrue(root.get("isActive")));
            if (search != null && !search.isBlank()) {
                String term = "%" + search.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("code")), term, '\\'),
                                     cb.like(cb.lower(root.get("name")), term, '\\')));
            }
            if (status != null && !status.isBlank() && !"all".equalsIgnoreCase(status)) predicates.add(cb.equal(root.get("status"), status));
            if (program != null && !program.isBlank()) predicates.add(cb.equal(root.get("program"), program));
            if (from != null) predicates.add(cb.greaterThanOrEqualTo(root.get("startDate"), from));
            if (to != null) predicates.add(cb.lessThanOrEqualTo(root.get("startDate"), to));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Sort order = Sort.by(Sort.Direction.fromString(direction), sort.equals("trainees") ? "plannedSize" : sort).and(Sort.by("id"));
        Page<TrainingClass> result = repository.findAll(spec, PageRequest.of(page, size, order));
        return new ClassPage(result.map(this::dto).getContent(), result.getTotalElements(), result.getTotalPages(),
                page, size, repository.findPrograms());
    }

    public TrainingClassDTO get(Long id) {
        return dto(repository.findByIdAndIsActiveTrue(id).orElseThrow(() -> new ResourceNotFoundException("Class not found")));
    }

    @Transactional
    public TrainingClassDTO create(TrainingClassDTO input) {
        if (!"planning".equals(input.getStatus())) throw new BadRequestException("New classes must start in planning status");
        TrainingClass entity = new TrainingClass();
        validate(input, 0L);
        BeanUtils.copyProperties(input, entity, "id");
        return save(entity);
    }

    @Transactional
    public List<TrainingClassDTO> importClasses(List<TrainingClassDTO> inputs) {
        if (inputs == null || inputs.isEmpty() || inputs.size() > 500)
            throw new BusinessValidationException(Map.of("input", List.of("Import between 1 and 500 classes")));
        Map<String, List<String>> errors = new LinkedHashMap<>();
        Map<String, Integer> codes = new HashMap<>();
        for (int i = 0; i < inputs.size(); i++) {
            TrainingClassDTO input = inputs.get(i);
            String path = "[" + i + "]";
            if (input == null) {
                importError(errors, path, "Class is required");
                continue;
            }
            for (var violation : validator.validate(input))
                importError(errors, path + "." + violation.getPropertyPath(), violation.getMessage());
            if (!"planning".equals(input.getStatus()))
                importError(errors, path + ".status", "New classes must start in planning status");
            if (input.getStartDate() != null && input.getEndDate() != null && !input.getEndDate().isAfter(input.getStartDate()))
                importError(errors, path + ".endDate", "End date must be after start date");
            if (input.getCode() != null && !input.getCode().isBlank()) {
                Integer previous = codes.putIfAbsent(input.getCode().toUpperCase(Locale.ROOT), i);
                if (previous != null)
                    importError(errors, path + ".code", "Class code duplicates import item " + (previous + 1) + ": " + input.getCode());
                if (repository.existsByCodeIgnoreCaseAndIdNot(input.getCode(), 0L))
                    importError(errors, path + ".code", "Class code already exists: " + input.getCode());
            }
        }
        if (!errors.isEmpty()) throw new BusinessValidationException(errors);
        List<TrainingClassDTO> result = new ArrayList<>();
        for (int i = 0; i < inputs.size(); i++) {
            try { result.add(create(inputs.get(i))); }
            catch (ConflictException ex) {
                // A concurrent import may reserve a code after the preflight check.
                throw new BusinessValidationException(Map.of("[" + i + "].code", List.of(ex.getMessage())));
            }
        }
        return result;
    }

    private void importError(Map<String, List<String>> errors, String field, String message) {
        errors.computeIfAbsent(field, key -> new ArrayList<>()).add(message);
    }

    @Transactional
    public TrainingClassDTO update(Long id, TrainingClassDTO input) {
        TrainingClass entity = repository.findForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (input.getPlannedSize() < enrollments.occupiedSeats(id))
            throw new ConflictException("Planned capacity cannot be lower than the current enrollment.");
        validate(input, id);
        if (!Objects.equals(entity.getStatus(), input.getStatus()) &&
                !TRANSITIONS.get(entity.getStatus()).contains(input.getStatus()))
            throw new ConflictException("Invalid class status transition");
        if (Set.of("active", "completed", "closed").contains(entity.getStatus()) && !entity.getCode().equals(input.getCode()))
            throw new ConflictException("Cannot change the code of a class that has started");
        var activeSessions = sessions.findByClassId(id).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .sorted(Comparator.comparing(s -> s.getStartTime()))
                .toList();
        boolean datesChanged = !Objects.equals(entity.getStartDate(), input.getStartDate())
                || !Objects.equals(entity.getEndDate(), input.getEndDate());
        boolean hasOutOfBounds = activeSessions.stream().anyMatch(
                s -> s.getStartTime().toLocalDate().isBefore(input.getStartDate())
                        || s.getEndTime().toLocalDate().isAfter(input.getEndDate()));
        if (datesChanged || hasOutOfBounds) {
            long totalSpanDays = Math.max(0L, java.time.temporal.ChronoUnit.DAYS.between(input.getStartDate(), input.getEndDate()));
            int totalCount = activeSessions.size();
            for (int i = 0; i < totalCount; i++) {
                var session = activeSessions.get(i);
                long offsetDays = totalCount <= 1 ? 0L : Math.round((i * (double) totalSpanDays) / (totalCount - 1));
                LocalDate newDate = input.getStartDate().plusDays(offsetDays);
                if (newDate.isAfter(input.getEndDate())) {
                    newDate = input.getEndDate();
                }
                long durationMinutes = Math.max(30L, java.time.Duration.between(session.getStartTime(), session.getEndTime()).toMinutes());
                var startLocalTime = session.getStartTime().toLocalTime();
                var newStart = newDate.atTime(startLocalTime);
                var newEnd = newStart.plusMinutes(durationMinutes);
                if (newEnd.toLocalDate().isAfter(input.getEndDate())) {
                    newEnd = input.getEndDate().atTime(23, 59);
                }
                session.setStartTime(newStart);
                session.setEndTime(newEnd);
                sessions.save(session);
            }
        }
        BeanUtils.copyProperties(input, entity, "id");
        return save(entity);
    }

    @Transactional
    public void deactivate(Long id) {
        TrainingClass entity = repository.findForUpdate(id).orElseThrow(() -> new ResourceNotFoundException("Class not found"));
        if (!enrollments.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(id).isEmpty())
            throw new ConflictException("Cannot deactivate a class with trainee enrollments");
        if (Set.of("active", "completed", "closed").contains(entity.getStatus()))
            throw new ConflictException("Cannot deactivate a class that has started");
        if (!sessions.findByClassId(id).stream().filter(s -> Boolean.TRUE.equals(s.getIsActive())).toList().isEmpty())
            throw new ConflictException("Cannot deactivate a class with sessions");
        entity.setIsActive(false);
        repository.save(entity);
    }

    private void validate(TrainingClassDTO input, Long id) {
        if (!input.getEndDate().isAfter(input.getStartDate())) throw new BadRequestException("End date must be after start date");
        if (repository.existsByCodeIgnoreCaseAndIdNot(input.getCode(), id)) throw new ConflictException("Class code already exists");
    }

    private TrainingClassDTO save(TrainingClass entity) {
        try { return dto(repository.saveAndFlush(entity)); }
        catch (DataIntegrityViolationException ex) { throw new ConflictException("Class code already exists"); }
    }

    private TrainingClassDTO dto(TrainingClass entity) {
        TrainingClassDTO dto = new TrainingClassDTO();
        BeanUtils.copyProperties(entity, dto);
        dto.setEnrolledTrainees(enrollments.occupiedSeats(entity.getId()));
        dto.setTraineeSource("internal");
        return dto;
    }
}
