package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.system.demo.session.Session;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ClassSetupServiceImpl implements ClassSetupService {
    private final ClassTrainingProgramRepository classTrainingProgramRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final TrainingProgramRepository trainingProgramRepository;
    private final ProgramSubjectRepository programSubjectRepository;
    private final ExternalApiService externalApiService;
    private final AssignmentSessionHistory sessionHistory;
    private final TeachingAssignmentSessionGuard assignmentSessionGuard;

    @Override
    public ClassProgramSubjectsResponse assignProgram(Long classId, Long programId) {
        assignmentSessionGuard.lockForWrite();
        ExternalClassDTO externalClass = requireClass(classId);
        requireActiveClass(externalClass);
        TrainingProgram program = requireProgram(programId);
        if (program.getStatus() != ProgramStatus.ACTIVE) {
            throw new IllegalArgumentException("Only ACTIVE programs can be assigned to a class.");
        }

        Long currentProgramId = resolveProgramId(classId, externalClass);
        if (!Objects.equals(currentProgramId, programId)
                && teachingAssignmentRepository.existsByClassId(classId)) {
            throw new ConflictException("This class already has teaching assignments. End or remove them before changing its program.");
        }

        ClassTrainingProgram link = classTrainingProgramRepository.findByClassId(classId)
                .orElseGet(ClassTrainingProgram::new);
        link.setClassId(classId);
        link.setProgram(program);
        classTrainingProgramRepository.save(link);
        return toClassProgramSubjects(externalClass, program);
    }

    @Override
    @Transactional(readOnly = true)
    public ClassProgramSubjectsResponse getClassProgramSubjects(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Long programId = resolveProgramId(classId, externalClass);
        if (programId == null) {
            return new ClassProgramSubjectsResponse(classId, externalClass.getCode(), externalClass.getName(), null, List.of());
        }
        TrainingProgram program = requireProgram(programId);
        return toClassProgramSubjects(externalClass, program);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getClassAssignments(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        return teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
                .map(assignment -> toResponse(assignment, externalClass, trainers.get(assignment.getTrainerId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date) {
        return getAvailableClassAssignments(classId, date, null, null, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date, Long programSubjectId,
            java.time.LocalDateTime from, java.time.LocalDateTime to) {
        if ((from == null) != (to == null) || (date != null && from != null))
            throw fieldError("from", "Provide either date or both from and to.");
        if (from != null && !to.isAfter(from)) throw fieldError("to", "The end must be after the start.");
        if (programSubjectId != null && programSubjectId <= 0) throw fieldError("programSubjectId", "Use a positive program subject ID.");
        LocalDate effectiveOn = from != null ? from.toLocalDate() : date == null ? LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")) : date;
        LocalDate lastDay = to == null ? effectiveOn : to.toLocalDate();
        var directory=getSchedulingDirectory(classId);
        var externalClass=directory.classProfile();
        LocalDate first = classDate(externalClass.getStartDate()), last = classDate(externalClass.getEndDate());
        if ((first != null && effectiveOn.isBefore(first)) || (last != null && lastDay.isAfter(last))) return List.of();
        return directory.assignments().stream()
                .filter(a->programSubjectId==null || programSubjectId.equals(a.programSubjectId()))
                .filter(a->!effectiveOn.isBefore(a.effectiveFrom()) && (a.effectiveTo()==null || !lastDay.isAfter(a.effectiveTo())))
                .toList();
    }

    @Override
    @Transactional(readOnly=true)
    public SchedulingDirectory getSchedulingDirectory(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        validateClassDates(externalClass);
        if (!isActive(externalClass.getStatus())) return new SchedulingDirectory(externalClass,List.of());
        Long programId = resolveProgramId(classId, externalClass);
        if (programId == null || requireProgram(programId).getStatus() != ProgramStatus.ACTIVE) return new SchedulingDirectory(externalClass,List.of());
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        var eligible=teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
                .filter(assignment -> Boolean.TRUE.equals(assignment.getIsActive()))
                .filter(assignment -> Objects.equals(assignment.getProgramSubject().getProgram().getId(), programId))
                .filter(assignment -> isActiveSubject(assignment.getProgramSubject().getSubject()))
                .filter(assignment -> trainers.containsKey(assignment.getTrainerId()) && isActive(trainers.get(assignment.getTrainerId()).getStatus()))
                .map(assignment -> toResponse(assignment, externalClass, trainers.get(assignment.getTrainerId())))
                .toList();
        return new SchedulingDirectory(externalClass,eligible);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TeachingAssignmentResponse> searchAssignments(Long classId, Long programSubjectId,
                                                                Long trainerId, AssignmentRole role,
                                                                LocalDate effectiveOn, String search, Long subjectId, Pageable pageable) {
        if (pageable.getPageSize() > 100 || pageable.getPageNumber() > 100000) {
            throw new IllegalArgumentException("Page size must be at most 100 and page at most 100000.");
        }
        String term = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        if (term.length() > 100) throw new IllegalArgumentException("Search must be at most 100 characters.");
        Set<String> sortable = Set.of("id", "effectiveFrom", "effectiveTo", "role", "classId", "trainerId");
        for (Sort.Order order : pageable.getSort()) {
            if (!sortable.contains(order.getProperty())) throw new IllegalArgumentException("Unsupported assignment sort field.");
        }
        // A unique tie breaker keeps records stable between server pages.
        Sort sort = pageable.getSort().getOrderFor("id") == null
                ? pageable.getSort().and(Sort.by("id")) : pageable.getSort();
        Pageable stablePage = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort);
        Map<Long, ExternalClassDTO> classes = externalApiService.fetchClasses(null).stream()
                .filter(item -> item.getId() != null).collect(Collectors.toMap(ExternalClassDTO::getId, item -> item, (a, b) -> a));
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        List<Long> matchingClasses = classes.values().stream()
                .filter(item -> contains(item.getCode(), term) || contains(item.getName(), term))
                .map(ExternalClassDTO::getId).toList();
        List<Long> matchingTrainers = trainers.values().stream()
                .filter(item -> contains(item.getName(), term) || contains(item.getEmail(), term))
                .map(ExternalTrainerDTO::getId).toList();
        String pattern = "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        Specification<TeachingAssignment> specification = (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (classId != null) predicates.add(criteriaBuilder.equal(root.get("classId"), classId));
            if (programSubjectId != null) predicates.add(criteriaBuilder.equal(root.get("programSubject").get("id"), programSubjectId));
            if (subjectId != null) predicates.add(criteriaBuilder.equal(root.get("programSubject").get("subject").get("id"), subjectId));
            if (!term.isEmpty()) {
                List<Predicate> matches = new ArrayList<>();
                var subject = root.get("programSubject").get("subject");
                matches.add(criteriaBuilder.like(criteriaBuilder.lower(subject.get("code")), pattern, '\\'));
                matches.add(criteriaBuilder.like(criteriaBuilder.lower(subject.get("name")), pattern, '\\'));
                if (!matchingClasses.isEmpty()) matches.add(root.get("classId").in(matchingClasses));
                if (!matchingTrainers.isEmpty()) matches.add(root.get("trainerId").in(matchingTrainers));
                predicates.add(criteriaBuilder.or(matches.toArray(Predicate[]::new)));
            }
            if (trainerId != null) predicates.add(criteriaBuilder.equal(root.get("trainerId"), trainerId));
            if (role != null) predicates.add(criteriaBuilder.equal(root.get("role"), role));
            if (effectiveOn != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.<LocalDate>get("effectiveFrom"), effectiveOn));
                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.isNull(root.<LocalDate>get("effectiveTo")),
                        criteriaBuilder.greaterThanOrEqualTo(root.<LocalDate>get("effectiveTo"), effectiveOn)));
            }
            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };

        Page<TeachingAssignment> page = teachingAssignmentRepository.findAll(specification, stablePage);
        return page.map(assignment -> toResponse(assignment, classes.get(assignment.getClassId()),
                trainers.get(assignment.getTrainerId())));
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentOptions getAssignmentOptions() {
        return new TeachingAssignmentOptions(externalApiService.fetchClasses(null), externalApiService.fetchTrainers(null),
                teachingAssignmentRepository.findAssignedSubjects().stream()
                        .map(s -> new TeachingAssignmentOptions.SubjectOption(s.getId(), s.getCode(), s.getName(), s.getVersion())).toList(),
                externalApiService.isSampleData());
    }

    private boolean contains(String value, String term) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(term);
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentCreateOptions getAssignmentCreateOptions() {
        Map<Long, Long> linkedPrograms = classTrainingProgramRepository.findAll().stream()
                .collect(Collectors.toMap(ClassTrainingProgram::getClassId, link -> link.getProgram().getId()));
        Set<Long> activePrograms = trainingProgramRepository.findAll().stream()
                .filter(program -> program.getStatus() == ProgramStatus.ACTIVE)
                .map(TrainingProgram::getId).collect(Collectors.toSet());
        List<ExternalClassDTO> classes = externalApiService.fetchClasses("active").stream()
                .filter(item -> isActive(item.getStatus()))
                .filter(item -> activePrograms.contains(linkedPrograms.getOrDefault(item.getId(), item.getProgramId())))
                .toList();
        return new TeachingAssignmentCreateOptions(classes, externalApiService.fetchTrainers("active").stream()
                .filter(item -> isActive(item.getStatus())).toList(), externalApiService.isSampleData());
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentCreateOptions.ClassContext getAssignmentCreateContext(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        requireActiveClass(externalClass);
        validateClassDates(externalClass);
        Long programId = resolveProgramId(classId, externalClass);
        if (programId == null) throw fieldError("classId", "Assign an active training program to this class first.");
        TrainingProgram program = requireProgram(programId);
        if (program.getStatus() != ProgramStatus.ACTIVE) {
            throw fieldError("classId", "The class training program is not active.");
        }
        return new TeachingAssignmentCreateOptions.ClassContext(externalClass,
                new ClassProgramSubjectsResponse.ProgramSummary(program.getId(), program.getCode(), program.getName(), program.getVersion(), program.getStatus()),
                program.getSubjects().stream().sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                        .filter(item -> isActiveSubject(item.getSubject()))
                        .map(item -> new TeachingAssignmentCreateOptions.SubjectOption(item.getId(), item.getSubject().getId(),
                                item.getSubject().getCode(), item.getSubject().getName(), item.getSubject().getVersion())).toList());
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentResponse getAssignment(Long id) {
        TeachingAssignment assignment = findAssignment(id);
        return toResponse(assignment, findClassOrNull(assignment.getClassId()),
                fetchTrainerLookup().get(assignment.getTrainerId()));
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TeachingAssignmentSessionResponse> getAssignmentSessions(Long id, Session.SessionStatus status, Pageable pageable) {
        // This endpoint works even when the external profile service is unavailable.
        findAssignment(id);
        if (pageable.getPageSize() > 100 || pageable.getPageNumber() > 100000) {
            throw new IllegalArgumentException("Page size must be at most 100 and page at most 100000.");
        }
        Set<String> sortable = Set.of("id", "startTime", "endTime", "status");
        for (Sort.Order order : pageable.getSort()) {
            if (!sortable.contains(order.getProperty())) throw new IllegalArgumentException("Unsupported session sort field.");
        }
        Sort sort = pageable.getSort().getOrderFor("id") == null
                ? pageable.getSort().and(Sort.by("id")) : pageable.getSort();
        return sessionHistory.sessions(id, status, PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), sort));
    }

    @Override
    public TeachingAssignmentResponse createAssignment(TeachingAssignmentRequest request) {
        assignmentSessionGuard.lockForWrite();
        ExternalClassDTO externalClass = requireClass(request.classId());
        requireActiveClass(externalClass);
        request = boundEffectiveTo(request, externalClass);
        ExternalTrainerDTO trainer = requireActiveTrainer(request.trainerId());
        validateAssignment(request, null, externalClass);

        TeachingAssignment assignment = new TeachingAssignment();
        apply(assignment, request);
        TeachingAssignment saved = teachingAssignmentRepository.save(assignment);
        return toResponse(saved, externalClass, trainer);
    }

    @Override
    public TeachingAssignmentResponse updateAssignment(Long id, TeachingAssignmentRequest request) {
        ExternalClassDTO externalClass = requireClass(request.classId());
        requireActiveClass(externalClass);
        request = boundEffectiveTo(request, externalClass);
        ExternalTrainerDTO trainer = requireActiveTrainer(request.trainerId());
        // Same lock as single/batch session writers, acquired before reading linked sessions.
        assignmentSessionGuard.lockForWrite();
        TeachingAssignment assignment = teachingAssignmentRepository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teaching assignment not found with ID: " + id));
        requireEditIdentity(assignment, request);
        validateAssignment(request, id, externalClass);
        if (impact(assignment, request, PageRequest.of(0, 1)).affectedSessionCount() > 0) {
            throw new ConflictException("This change affects linked sessions. Preview the impact and resolve those sessions before saving.");
        }

        apply(assignment, request);
        TeachingAssignment saved = teachingAssignmentRepository.saveAndFlush(assignment);
        return toResponse(saved, externalClass, trainer);
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentEditContext getAssignmentEditContext(Long id) {
        var assignment = findAssignment(id);
        var clazz = requireClass(assignment.getClassId());
        long linkedCount = sessionHistory.count(id);
        return new TeachingAssignmentEditContext(toResponse(assignment, clazz, fetchTrainerLookup().get(assignment.getTrainerId())),
                clazz, externalApiService.fetchTrainers("active").stream().filter(t -> isActive(t.getStatus())).toList(),
                linkedCount, Boolean.TRUE.equals(assignment.getEverUsed()) || linkedCount > 0);
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentImpactResponse previewAssignmentImpact(Long id, TeachingAssignmentRequest request, Pageable pageable) {
        var assignment = findAssignment(id);
        requireEditIdentity(assignment, request);
        var clazz = requireClass(assignment.getClassId());
        requireActiveClass(clazz);
        request = boundEffectiveTo(request, clazz);
        requireActiveTrainer(request.trainerId());
        validateAssignment(request, id, clazz, false);
        if (pageable.getPageSize() > 100 || pageable.getPageNumber() > 100000) {
            throw new IllegalArgumentException("Page size must be at most 100 and page at most 100000.");
        }
        return impact(assignment, request, pageable);
    }

    private void requireEditIdentity(TeachingAssignment assignment, TeachingAssignmentRequest request) {
        requireRevision(assignment, request.revision());
        if (!Objects.equals(assignment.getClassId(), request.classId())) throw fieldError("classId", "The class cannot be changed. Create a new assignment.");
        if (!Objects.equals(assignment.getProgramSubject().getId(), request.programSubjectId())) throw fieldError("programSubjectId", "The subject cannot be changed. Create a new assignment.");
        if (Boolean.TRUE.equals(assignment.getEverUsed()) && !Objects.equals(assignment.getTrainerId(), request.trainerId())) {
            throw new ConflictException("This assignment has been used before. Keep its trainer and create a replacement assignment instead.");
        }
    }

    private void requireRevision(TeachingAssignment assignment, Long revision) {
        if (revision == null || !Objects.equals(assignment.getRevision(), revision)) {
            throw new ConflictException("The assignment has changed or its revision is missing. Reload the current assignment before retrying.");
        }
    }

    private TeachingAssignmentImpactResponse impact(TeachingAssignment assignment, TeachingAssignmentRequest request, Pageable pageable) {
        boolean trainerChanged = !Objects.equals(assignment.getTrainerId(), request.trainerId());
        var until = request.effectiveTo() == null || request.effectiveTo().equals(LocalDate.MAX)
                ? null : request.effectiveTo().plusDays(1).atStartOfDay();
        var affected = sessionHistory.impacts(assignment.getId(), trainerChanged, request.classId(),
                request.trainerId(), request.effectiveFrom().atStartOfDay(), until,
                PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by("startTime").and(Sort.by("id"))));
        var rows = affected.map(row -> {
            var session = row.summary();
            List<String> reasons = new ArrayList<>();
            if (trainerChanged) reasons.add("Trainer changes are blocked once any session references this assignment. Create a replacement assignment instead.");
            if (session.status() != Session.SessionStatus.CANCELLED) {
                if (session.startTime().toLocalDate().isBefore(request.effectiveFrom())
                        || (request.effectiveTo() != null && session.endTime().toLocalDate().isAfter(request.effectiveTo()))) {
                    reasons.add("The session falls outside the proposed effective period.");
                }
                if (!Objects.equals(row.classId(), request.classId()) || !Objects.equals(row.trainerId(), request.trainerId())) {
                    reasons.add("The session class or trainer does not match the proposed assignment.");
                }
            }
            return new TeachingAssignmentImpactResponse.SessionImpact(session, reasons);
        });
        return new TeachingAssignmentImpactResponse(affected.getTotalElements() == 0, assignment.getRevision(),
                sessionHistory.count(assignment.getId()), affected.getTotalElements(),
                request.effectiveFrom(), request.effectiveTo(), rows);
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentLifecycleContext getAssignmentLifecycleContext(Long id) {
        var assignment = findAssignment(id);
        long count = sessionHistory.count(id);
        boolean used = Boolean.TRUE.equals(assignment.getEverUsed()) || count > 0;
        return new TeachingAssignmentLifecycleContext(toResponse(assignment, null, null), count, !used, used);
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentImpactResponse previewAssignmentEnd(Long id, TeachingAssignmentEndRequest request, Pageable pageable) {
        var assignment = findAssignment(id);
        var proposal = endProposal(assignment, request);
        if (pageable.getPageSize() > 100 || pageable.getPageNumber() > 100000) {
            throw new IllegalArgumentException("Page size must be at most 100 and page at most 100000.");
        }
        return impact(assignment, proposal, pageable);
    }

    @Override
    public TeachingAssignmentResponse endAssignment(Long id, TeachingAssignmentEndRequest request) {
        assignmentSessionGuard.lockForWrite();
        var assignment = findAssignmentForLifecycleWrite(id);
        var proposal = endProposal(assignment, request);
        if (impact(assignment, proposal, PageRequest.of(0, 1)).affectedSessionCount() > 0) {
            throw new ConflictException("Linked sessions fall outside the proposed end date. Preview the impact and resolve those sessions first.");
        }
        assignment.setEffectiveTo(request.effectiveTo());
        teachingAssignmentRepository.saveAndFlush(assignment);
        return toResponse(assignment, null, null);
    }

    private TeachingAssignmentRequest endProposal(TeachingAssignment assignment, TeachingAssignmentEndRequest request) {
        requireRevision(assignment, request.revision());
        if (request.effectiveTo().isBefore(assignment.getEffectiveFrom())) {
            throw fieldError("effectiveTo", "The end date must be on or after the assignment start date.");
        }
        if (assignment.getEffectiveTo() != null && request.effectiveTo().isAfter(assignment.getEffectiveTo())) {
            throw fieldError("effectiveTo", "Ending an assignment cannot extend its current effective period.");
        }
        return new TeachingAssignmentRequest(assignment.getClassId(), assignment.getProgramSubject().getId(),
                assignment.getTrainerId(), assignment.getRole(), assignment.getEffectiveFrom(), request.effectiveTo(), request.revision());
    }

    private TeachingAssignment findAssignmentForLifecycleWrite(Long id) {
        return teachingAssignmentRepository.findForUpdate(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teaching assignment not found with ID: " + id));
    }

    @Override
    public void deleteAssignment(Long id, Long revision) {
        assignmentSessionGuard.lockForWrite();
        var assignment = findAssignmentForLifecycleWrite(id);
        requireRevision(assignment, revision);
        long references = sessionHistory.count(id);
        if (references > 0 || Boolean.TRUE.equals(assignment.getEverUsed())) {
            throw new ConflictException(references > 0 ? "This assignment is referenced by " + references
                    + " session(s), including historical records, and cannot be deleted. End its effective period instead."
                    : "This assignment has been used previously and cannot be deleted. End its effective period instead.");
        }
        try {
            teachingAssignmentRepository.delete(assignment);
            teachingAssignmentRepository.flush();
        } catch (DataIntegrityViolationException exception) {
            throw new ConflictException("This teaching assignment is referenced by scheduled sessions and cannot be deleted.");
        }
    }

    private ClassProgramSubjectsResponse toClassProgramSubjects(ExternalClassDTO externalClass, TrainingProgram program) {
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        Map<Long, List<TeachingAssignmentResponse>> assignmentsByProgramSubject =
                teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(externalClass.getId()).stream()
                        .collect(Collectors.groupingBy(assignment -> assignment.getProgramSubject().getId(),
                                Collectors.mapping(assignment -> toResponse(assignment, externalClass,
                                        trainers.get(assignment.getTrainerId())), Collectors.toList())));

        List<ClassProgramSubjectsResponse.ProgramSubjectItem> subjects = program.getSubjects().stream()
                .sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                .map(programSubject -> {
                    Subject subject = programSubject.getSubject();
                    return new ClassProgramSubjectsResponse.ProgramSubjectItem(
                            programSubject.getId(), subject.getId(), subject.getCode(), subject.getName(),
                            subject.getDurationHours(), programSubject.getOrderIndex(),
                            assignmentsByProgramSubject.getOrDefault(programSubject.getId(), List.of()));
                })
                .toList();
        ClassProgramSubjectsResponse.ProgramSummary summary = new ClassProgramSubjectsResponse.ProgramSummary(
                program.getId(), program.getCode(), program.getName(), program.getVersion(), program.getStatus());
        return new ClassProgramSubjectsResponse(externalClass.getId(), externalClass.getCode(),
                externalClass.getName(), summary, subjects);
    }

    private void validateAssignment(TeachingAssignmentRequest request, Long ignoreId, ExternalClassDTO externalClass) {
        validateAssignment(request, ignoreId, externalClass, true);
    }

    private void validateAssignment(TeachingAssignmentRequest request, Long ignoreId, ExternalClassDTO externalClass, boolean lock) {
        validateClassDates(externalClass);
        if (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw fieldError("effectiveTo", "The end date must be on or after the start date.");
        }
        LocalDate classStart = classDate(externalClass.getStartDate());
        LocalDate classEnd = classDate(externalClass.getEndDate());
        if (classStart != null && request.effectiveFrom().isBefore(classStart)) {
            throw fieldError("effectiveFrom", "The start date must be within the class dates.");
        }
        if (classEnd != null && request.effectiveFrom().isAfter(classEnd)) {
            throw fieldError("effectiveFrom", "The start date must be within the class dates.");
        }
        if (classEnd != null && request.effectiveTo() != null && request.effectiveTo().isAfter(classEnd)) {
            throw fieldError("effectiveTo", "The end date must not be after the class end date.");
        }
        Long assignedProgramId = resolveProgramId(request.classId(), externalClass);
        if (assignedProgramId == null) {
            throw fieldError("classId", "Assign an active training program to this class first.");
        }

        ProgramSubject programSubject = (lock ? programSubjectRepository.findForAssignmentById(request.programSubjectId())
                : programSubjectRepository.findById(request.programSubjectId()))
                .orElseThrow(() -> new ResourceNotFoundException("Program subject not found with ID: " + request.programSubjectId()));
        if (!Objects.equals(programSubject.getProgram().getId(), assignedProgramId)) {
            throw fieldError("programSubjectId", "The subject does not belong to this class training program.");
        }
        if (programSubject.getProgram().getStatus() != ProgramStatus.ACTIVE) {
            throw fieldError("classId", "The class training program is not active.");
        }
        Subject subject = programSubject.getSubject();
        if (!isActiveSubject(subject)) {
            throw fieldError("programSubjectId", "Select an active subject.");
        }
        if (teachingAssignmentRepository.existsOverlappingTrainerAssignment(request.classId(), request.programSubjectId(),
                request.trainerId(), request.effectiveFrom(), request.effectiveTo(), ignoreId)) {
            throw new ConflictException("The trainer already has an overlapping assignment for this class subject.");
        }
        if (request.role() == AssignmentRole.MAIN
                && teachingAssignmentRepository.existsOverlappingMainAssignment(request.classId(), request.programSubjectId(),
                request.effectiveFrom(), request.effectiveTo(), ignoreId)) {
            throw new ConflictException("A main trainer is already assigned to this class subject during that period.");
        }
    }

    private void apply(TeachingAssignment assignment, TeachingAssignmentRequest request) {
        ProgramSubject programSubject = programSubjectRepository.findById(request.programSubjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Program subject not found with ID: " + request.programSubjectId()));
        assignment.setClassId(request.classId());
        assignment.setProgramSubject(programSubject);
        assignment.setTrainerId(request.trainerId());
        assignment.setRole(request.role());
        assignment.setEffectiveFrom(request.effectiveFrom());
        assignment.setEffectiveTo(request.effectiveTo());
    }

    private Long resolveProgramId(Long classId, ExternalClassDTO externalClass) {
        ClassTrainingProgram link = classTrainingProgramRepository.findByClassId(classId).orElse(null);
        if (link != null) return link.getProgram().getId();
        Long sharedProgramId = externalClass.getProgramId();
        return sharedProgramId != null && trainingProgramRepository.existsById(sharedProgramId)
                ? sharedProgramId : null;
    }

    private TrainingProgram requireProgram(Long programId) {
        return trainingProgramRepository.findById(programId)
                .orElseThrow(() -> new ResourceNotFoundException("Training program not found with ID: " + programId));
    }

    private TeachingAssignment findAssignment(Long id) {
        return teachingAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Teaching assignment not found with ID: " + id));
    }

    private ExternalClassDTO requireClass(Long classId) {
        ExternalClassDTO externalClass = externalApiService.fetchClassById(classId);
        if (externalClass == null || externalClass.getId() == null) {
            throw new ResourceNotFoundException("Class not found with ID: " + classId);
        }
        return externalClass;
    }

    private ExternalClassDTO findClassOrNull(Long classId) {
        try {
            return externalApiService.fetchClassById(classId);
        } catch (ExternalApiException exception) {
            if (exception.getStatusCode() == 404) return null;
            throw exception;
        }
    }

    private void requireActiveClass(ExternalClassDTO externalClass) {
        if (!isActive(externalClass.getStatus())) {
            throw fieldError("classId", "Select an active class.");
        }
    }

    private ExternalTrainerDTO requireActiveTrainer(Long trainerId) {
        return externalApiService.fetchTrainers("active").stream()
                .filter(trainer -> Objects.equals(trainer.getId(), trainerId))
                .filter(trainer -> isActive(trainer.getStatus()))
                .findFirst()
                .orElseThrow(() -> fieldError("trainerId", "Select an active trainer from the trainer directory."));
    }

    private boolean isActive(String status) {
        return "active".equalsIgnoreCase(status);
    }

    private boolean isActiveSubject(Subject subject) {
        return Boolean.TRUE.equals(subject.getIsActive()) && subject.getStatus() == SubjectStatus.ACTIVE;
    }

    private BusinessValidationException fieldError(String field, String message) {
        return new BusinessValidationException(Map.of(field, List.of(message)));
    }

    private LocalDate classDate(String date) {
        try {
            return date == null || date.isBlank() ? null : LocalDate.parse(date);
        } catch (DateTimeParseException exception) {
            throw new ExternalApiException("The shared class has an invalid date. Contact the class administrator.", 502, null);
        }
    }

    private void validateClassDates(ExternalClassDTO externalClass) {
        LocalDate start = classDate(externalClass.getStartDate());
        LocalDate end = classDate(externalClass.getEndDate());
        if (start != null && end != null && end.isBefore(start)) {
            throw new ExternalApiException("The shared class date range is invalid. Contact the class administrator.", 502, null);
        }
    }

    private TeachingAssignmentRequest boundEffectiveTo(TeachingAssignmentRequest request, ExternalClassDTO externalClass) {
        // An omitted end date is bounded by the class end, when the shared class has one.
        LocalDate end = request.effectiveTo() == null ? classDate(externalClass.getEndDate()) : request.effectiveTo();
        return new TeachingAssignmentRequest(request.classId(), request.programSubjectId(), request.trainerId(),
                request.role(), request.effectiveFrom(), end, request.revision());
    }

    private Map<Long, ExternalTrainerDTO> fetchTrainerLookup() {
        Map<Long, ExternalTrainerDTO> trainers = new HashMap<>();
        for (ExternalTrainerDTO trainer : externalApiService.fetchTrainers(null)) {
            if (trainer.getId() != null) trainers.put(trainer.getId(), trainer);
        }
        return trainers;
    }

    private TeachingAssignmentResponse toResponse(TeachingAssignment assignment, ExternalClassDTO externalClass,
                                                   ExternalTrainerDTO trainer) {
        Subject subject = assignment.getProgramSubject().getSubject();
        return new TeachingAssignmentResponse(
                assignment.getId(), assignment.getClassId(), externalClass == null ? null : externalClass.getCode(),
                assignment.getProgramSubject().getId(), subject.getId(), subject.getCode(), subject.getName(),
                assignment.getTrainerId(), trainer == null ? null : trainer.getName(), assignment.getRole(),
                assignment.getEffectiveFrom(), assignment.getEffectiveTo(),
                externalClass == null ? null : externalClass.getName(), subject.getVersion(),
                trainer == null ? null : trainer.getEmail(), assignment.getProgramSubject().getProgram().getId(),
                assignment.getProgramSubject().getProgram().getCode(), assignment.getProgramSubject().getProgram().getName(),
                assignment.getProgramSubject().getProgram().getVersion(), assignment.getRevision());
    }

    private boolean isEffectiveOn(TeachingAssignment assignment, LocalDate date) {
        return !assignment.getEffectiveFrom().isAfter(date)
                && (assignment.getEffectiveTo() == null || !assignment.getEffectiveTo().isBefore(date));
    }
}
