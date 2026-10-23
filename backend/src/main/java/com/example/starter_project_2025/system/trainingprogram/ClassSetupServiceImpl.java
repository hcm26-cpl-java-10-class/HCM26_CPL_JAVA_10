package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.external_api.ExternalApiService;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassDTO;
import com.example.starter_project_2025.system.external_api.dto.ExternalClassRequest;
import com.example.starter_project_2025.system.external_api.dto.ExternalTrainerDTO;
import com.example.starter_project_2025.system.external_api.exception.ExternalApiException;
import com.example.starter_project_2025.system.subject.Subject;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
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

    @Override
    public ExternalClassDTO createClass(ExternalClassRequest request) {
        validateClassDates(request);
        return externalApiService.createClass(request);
    }

    @Override
    public ExternalClassDTO updateClass(Long classId, ExternalClassRequest request) {
        requireClass(classId);
        validateClassDates(request);
        return externalApiService.updateClass(classId, request);
    }

    @Override
    public void deleteClass(Long classId) {
        requireClass(classId);
        if (teachingAssignmentRepository.existsByClassId(classId)) {
            throw new ConflictException("Không thể xóa lớp đang có phân công giảng dạy. Hãy gỡ các phân công trước.");
        }
        externalApiService.deleteClass(classId);
        classTrainingProgramRepository.findByClassId(classId).ifPresent(classTrainingProgramRepository::delete);
    }

    private void validateClassDates(ExternalClassRequest request) {
        try {
            LocalDate startDate = request.startDate() == null || request.startDate().isBlank()
                    ? null : LocalDate.parse(request.startDate());
            LocalDate endDate = request.endDate() == null || request.endDate().isBlank()
                    ? null : LocalDate.parse(request.endDate());
            if (startDate != null && startDate.isBefore(LocalDate.now())) {
                throw new IllegalArgumentException("Expected start date cannot be in the past.");
            }
            if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
                throw new IllegalArgumentException("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
            }
        } catch (DateTimeParseException exception) {
            throw new IllegalArgumentException("Ngày bắt đầu và kết thúc phải là ngày hợp lệ theo định dạng yyyy-MM-dd.");
        }
    }

    @Override
    public ClassProgramSubjectsResponse assignProgram(Long classId, Long programId) {
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
        LocalDate effectiveOn = date == null ? LocalDate.now() : date;
        ExternalClassDTO externalClass = requireClass(classId);
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        return teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
                .filter(assignment -> isEffectiveOn(assignment, effectiveOn))
                .map(assignment -> toResponse(assignment, externalClass, trainers.get(assignment.getTrainerId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TeachingAssignmentResponse> searchAssignments(Long classId, Long programSubjectId,
                                                                Long trainerId, AssignmentRole role,
                                                                LocalDate effectiveOn, Pageable pageable) {
        Specification<TeachingAssignment> specification = (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (classId != null) predicates.add(criteriaBuilder.equal(root.get("classId"), classId));
            if (programSubjectId != null) predicates.add(criteriaBuilder.equal(root.get("programSubject").get("id"), programSubjectId));
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

        Page<TeachingAssignment> page = teachingAssignmentRepository.findAll(specification, pageable);
        Set<Long> classIds = page.getContent().stream().map(TeachingAssignment::getClassId).collect(Collectors.toSet());
        Map<Long, ExternalClassDTO> classes = new HashMap<>();
        for (Long id : classIds) classes.put(id, findClassOrNull(id));
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        return page.map(assignment -> toResponse(assignment, classes.get(assignment.getClassId()),
                trainers.get(assignment.getTrainerId())));
    }

    @Override
    @Transactional(readOnly = true)
    public TeachingAssignmentResponse getAssignment(Long id) {
        TeachingAssignment assignment = findAssignment(id);
        return toResponse(assignment, findClassOrNull(assignment.getClassId()),
                fetchTrainerLookup().get(assignment.getTrainerId()));
    }

    @Override
    public TeachingAssignmentResponse createAssignment(TeachingAssignmentRequest request) {
        ExternalClassDTO externalClass = requireClass(request.classId());
        requireActiveClass(externalClass);
        validateAssignment(request, null, externalClass);
        ExternalTrainerDTO trainer = requireActiveTrainer(request.trainerId());

        TeachingAssignment assignment = new TeachingAssignment();
        apply(assignment, request);
        TeachingAssignment saved = teachingAssignmentRepository.save(assignment);
        return toResponse(saved, externalClass, trainer);
    }

    @Override
    public TeachingAssignmentResponse updateAssignment(Long id, TeachingAssignmentRequest request) {
        TeachingAssignment assignment = findAssignment(id);
        ExternalClassDTO externalClass = requireClass(request.classId());
        requireActiveClass(externalClass);
        validateAssignment(request, id, externalClass);
        ExternalTrainerDTO trainer = requireActiveTrainer(request.trainerId());

        apply(assignment, request);
        TeachingAssignment saved = teachingAssignmentRepository.save(assignment);
        return toResponse(saved, externalClass, trainer);
    }

    @Override
    public void deleteAssignment(Long id) {
        TeachingAssignment assignment = findAssignment(id);
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
        if (request.effectiveTo() != null && request.effectiveTo().isBefore(request.effectiveFrom())) {
            throw new IllegalArgumentException("effectiveTo must be on or after effectiveFrom.");
        }
        Long assignedProgramId = resolveProgramId(request.classId(), externalClass);
        if (assignedProgramId == null) {
            throw new IllegalArgumentException("Assign an ACTIVE training program to the class before adding teaching assignments.");
        }

        ProgramSubject programSubject = programSubjectRepository.findById(request.programSubjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Program subject not found with ID: " + request.programSubjectId()));
        if (!Objects.equals(programSubject.getProgram().getId(), assignedProgramId)) {
            throw new IllegalArgumentException("The selected subject does not belong to the program assigned to this class.");
        }
        Subject subject = programSubject.getSubject();
        if (!Boolean.TRUE.equals(subject.getIsActive())) {
            throw new IllegalArgumentException("Inactive subjects cannot be assigned to a trainer.");
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
        if (externalClass.getStatus() != null && !externalClass.getStatus().isBlank()
                && !"active".equalsIgnoreCase(externalClass.getStatus())) {
            throw new IllegalArgumentException("Only active classes can receive program or teaching assignments.");
        }
    }

    private ExternalTrainerDTO requireActiveTrainer(Long trainerId) {
        return externalApiService.fetchTrainers("active").stream()
                .filter(trainer -> Objects.equals(trainer.getId(), trainerId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Trainer not found or inactive: " + trainerId));
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
                assignment.getEffectiveFrom(), assignment.getEffectiveTo());
    }

    private boolean isEffectiveOn(TeachingAssignment assignment, LocalDate date) {
        return !assignment.getEffectiveFrom().isAfter(date)
                && (assignment.getEffectiveTo() == null || !assignment.getEffectiveTo().isBefore(date));
    }
}
