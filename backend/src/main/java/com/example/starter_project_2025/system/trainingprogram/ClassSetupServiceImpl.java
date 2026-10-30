package com.example.starter_project_2025.system.trainingprogram;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ClassSetupServiceImpl implements ClassSetupService {
    private final ClassTrainingProgramRepository classTrainingProgramRepository;
    private final ClassTopicCourseRepository classTopicCourseRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final TrainingProgramRepository trainingProgramRepository;
    private final ProgramSubjectRepository programSubjectRepository;
    private final CourseRepository courseRepository;
    private final SessionRepository sessionRepository;
    private final ExternalApiService externalApiService;

    @Override
    @Transactional(readOnly = true)
    public List<ClassSetupOverviewResponse> getSetupOverview() {
        List<ExternalClassDTO> sharedClasses = externalApiService.fetchClasses(null);
        if (sharedClasses.isEmpty()) {
            return List.of();
        }

        Map<Long, TrainingProgram> programByClassId = classTrainingProgramRepository.findAll().stream()
                .collect(Collectors.toMap(ClassTrainingProgram::getClassId, ClassTrainingProgram::getProgram, (a, b) -> b));
        Map<Long, List<ClassTopicCourse>> topicCoursesByClassId = classTopicCourseRepository.findAll().stream()
                .collect(Collectors.groupingBy(ClassTopicCourse::getClassId));
        Map<Long, List<TeachingAssignment>> assignmentsByClassId = teachingAssignmentRepository.findAll().stream()
                .collect(Collectors.groupingBy(TeachingAssignment::getClassId));
        Map<Long, List<Session>> sessionsByClassId = sessionRepository.findAll().stream()
                .filter(this::isEffectiveSession)
                .collect(Collectors.groupingBy(Session::getClassId));

        List<ClassSetupOverviewResponse> result = new ArrayList<>(sharedClasses.size());
        for (ExternalClassDTO externalClass : sharedClasses) {
            Long classId = externalClass.getId();
            TrainingProgram program = programByClassId.get(classId);
            if (program == null && externalClass.getProgramId() != null) {
                program = trainingProgramRepository.findById(externalClass.getProgramId()).orElse(null);
            }

            List<ClassTopicCourse> classCourses = topicCoursesByClassId.getOrDefault(classId, List.of());
            List<TeachingAssignment> classAssignments = assignmentsByClassId.getOrDefault(classId, List.of());
            List<Session> classSessions = sessionsByClassId.getOrDefault(classId, List.of());

            int totalSubjects = 0;
            int coursesAssignedCount = 0;
            int subjectsWithTrainerCount = 0;
            int subjectsWithScheduleCount = 0;

            if (program != null) {
                Set<Long> coursePsIds = classCourses.stream()
                        .map(item -> item.getProgramSubject().getId())
                        .collect(Collectors.toSet());
                Map<Long, List<TeachingAssignment>> assignmentsByPs = classAssignments.stream()
                        .collect(Collectors.groupingBy(a -> a.getProgramSubject().getId()));

                totalSubjects = program.getSubjects().size();
                for (ProgramSubject ps : program.getSubjects()) {
                    if (coursePsIds.contains(ps.getId())) {
                        coursesAssignedCount++;
                    }
                    List<TeachingAssignment> psAssignments = assignmentsByPs.getOrDefault(ps.getId(), List.of());
                    if (!psAssignments.isEmpty()) {
                        subjectsWithTrainerCount++;
                    }
                    Set<Long> assignmentIds = psAssignments.stream()
                            .map(TeachingAssignment::getId)
                            .collect(Collectors.toSet());
                    long matchedSessions = classSessions.stream()
                            .filter(s -> matchesSubjectSession(s, ps.getSubject().getId(), assignmentIds))
                            .count();
                    if (matchedSessions > 0) {
                        subjectsWithScheduleCount++;
                    }
                }
            }

            int missingCourseCount = Math.max(0, totalSubjects - coursesAssignedCount);
            int missingTrainerCount = Math.max(0, totalSubjects - subjectsWithTrainerCount);
            int missingScheduleCount = Math.max(0, totalSubjects - subjectsWithScheduleCount);
            boolean setupComplete = program != null && totalSubjects > 0
                    && missingCourseCount == 0 && missingTrainerCount == 0 && missingScheduleCount == 0;

            result.add(new ClassSetupOverviewResponse(
                    classId,
                    externalClass.getCode(),
                    externalClass.getName(),
                    externalClass.getStatus(),
                    externalClass.getStartDate(),
                    externalClass.getEndDate(),
                    externalClass.getSite(),
                    externalClass.getLocation(),
                    externalClass.getFormatType(),
                    externalClass.getPlannedSize(),
                    getEnrolledCount(externalClass),
                    program == null ? null : program.getId(),
                    program == null ? null : program.getCode(),
                    program == null ? null : program.getName(),
                    program == null ? null : program.getVersion(),
                    totalSubjects,
                    coursesAssignedCount,
                    subjectsWithTrainerCount,
                    subjectsWithScheduleCount,
                    classSessions.size(),
                    missingCourseCount,
                    missingTrainerCount,
                    missingScheduleCount,
                    setupComplete
            ));
        }
        return result;
    }

    @Override
    public ExternalClassDTO createClass(ExternalClassRequest request) {
        validateClassDates(request, null);
        return externalApiService.createClass(request);
    }

    @Override
    public ExternalClassDTO updateClass(Long classId, ExternalClassRequest request) {
        ExternalClassDTO existing = requireClass(classId);
        validateClassDates(request, existing.getStartDate());
        return externalApiService.updateClass(classId, request);
    }

    @Override
    public void deleteClass(Long classId) {
        requireClass(classId);
        if (teachingAssignmentRepository.existsByClassId(classId)) {
            throw new ConflictException("Không thể xóa lớp đang có phân công giảng dạy. Hãy gỡ các phân công trước.");
        }
        if (classTopicCourseRepository.existsByClassId(classId)) {
            throw new ConflictException("Không thể xóa lớp đang có liên kết Course theo Topic.");
        }
        if (!findEffectiveClassSessions(classId).isEmpty()) {
            throw new ConflictException("Không thể xóa lớp đã phát sinh buổi học trên lịch.");
        }
        externalApiService.deleteClass(classId);
        classTrainingProgramRepository.findByClassId(classId).ifPresent(classTrainingProgramRepository::delete);
    }

    private void validateClassDates(ExternalClassRequest request, String existingStartDate) {
        try {
            String normalizedStart = request.startDate() == null || request.startDate().isBlank()
                    ? null : request.startDate().trim();
            LocalDate startDate = normalizedStart == null ? null : LocalDate.parse(normalizedStart);
            LocalDate endDate = request.endDate() == null || request.endDate().isBlank()
                    ? null : LocalDate.parse(request.endDate().trim());
            boolean unchangedExistingStart = existingStartDate != null && Objects.equals(normalizedStart, existingStartDate.trim());
            if (startDate != null && !unchangedExistingStart && startDate.isBefore(LocalDate.now())) {
                throw new IllegalArgumentException("Ngày bắt đầu dự kiến không được ở trong quá khứ.");
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
            throw new IllegalArgumentException("Chỉ chương trình đào tạo ở trạng thái ACTIVE mới được gán cho lớp.");
        }

        Long currentProgramId = resolveProgramId(classId, externalClass);
        if (currentProgramId != null && !Objects.equals(currentProgramId, programId)) {
            List<String> blockReasons = collectProgramModificationBlockReasons(classId, externalClass);
            if (!blockReasons.isEmpty()) {
                throw new ConflictException(
                        "Không thể đổi chương trình đào tạo của lớp " + externalClass.getCode() + ": "
                                + String.join("; ", blockReasons)
                                + ". Hệ thống chặn thay đổi phá vỡ dữ liệu đang dùng và không tự xóa phân công/lịch học."
                );
            }
        }

        ClassTrainingProgram link = classTrainingProgramRepository.findByClassId(classId)
                .orElseGet(ClassTrainingProgram::new);
        link.setClassId(classId);
        link.setProgram(program);
        classTrainingProgramRepository.save(link);
        return toClassProgramSubjects(externalClass, program);
    }

    @Override
    public ClassProgramSubjectsResponse removeProgram(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Long currentProgramId = resolveProgramId(classId, externalClass);
        if (currentProgramId == null) {
            throw new IllegalArgumentException("Lớp " + externalClass.getCode() + " hiện chưa được gán chương trình đào tạo.");
        }

        List<String> blockReasons = collectProgramModificationBlockReasons(classId, externalClass);
        if (!blockReasons.isEmpty()) {
            throw new ConflictException(
                    "Không thể bỏ chương trình đào tạo của lớp " + externalClass.getCode() + ": "
                            + String.join("; ", blockReasons)
                            + ". Hệ thống chặn thay đổi phá vỡ dữ liệu đang dùng và không tự xóa phân công/lịch học."
            );
        }

        classTrainingProgramRepository.findByClassId(classId).ifPresent(classTrainingProgramRepository::delete);
        return toClassProgramSubjects(externalClass, null);
    }

    @Override
    @Transactional(readOnly = true)
    public ClassProgramSubjectsResponse getClassProgramSubjects(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Long programId = resolveProgramId(classId, externalClass);
        TrainingProgram program = programId == null ? null : requireProgram(programId);
        return toClassProgramSubjects(externalClass, program);
    }

    @Override
    public ClassTopicCoursesSaveResponse saveTopicCourses(Long classId, ClassTopicCourseSaveRequest request) {
        ExternalClassDTO externalClass = requireClass(classId);
        requireActiveClass(externalClass);

        Long assignedProgramId = resolveProgramId(classId, externalClass);
        if (assignedProgramId == null) {
            throw new IllegalArgumentException("Lớp chưa được gán chương trình đào tạo ACTIVE. Hãy gán chương trình trước khi liên kết Course.");
        }
        TrainingProgram program = requireProgram(assignedProgramId);
        Map<Long, ProgramSubject> programSubjectMap = program.getSubjects().stream()
                .collect(Collectors.toMap(ProgramSubject::getId, Function.identity()));

        Set<Long> seenProgramSubjects = new HashSet<>();
        for (ClassTopicCourseSaveRequest.TopicCourseItem item : request.items()) {
            if (!seenProgramSubjects.add(item.programSubjectId())) {
                throw new IllegalArgumentException("Không được gửi trùng lặp Topic trong cùng một yêu cầu lưu Course.");
            }
        }

        int enrolledCount = getEnrolledCount(externalClass);
        Map<Long, ClassTopicCourse> existingByPsId = classTopicCourseRepository.findByClassId(classId).stream()
                .collect(Collectors.toMap(item -> item.getProgramSubject().getId(), Function.identity()));

        int assignedCount = 0;
        int updatedCount = 0;
        int removedCount = 0;
        int unchangedCount = 0;

        for (ClassTopicCourseSaveRequest.TopicCourseItem item : request.items()) {
            ProgramSubject programSubject = programSubjectMap.get(item.programSubjectId());
            if (programSubject == null) {
                throw new IllegalArgumentException(
                        "Môn học (programSubjectId=" + item.programSubjectId() + ") không thuộc chương trình đào tạo hiện tại của lớp."
                );
            }

            Subject subject = programSubject.getSubject();
            ClassTopicCourse existing = existingByPsId.get(programSubject.getId());
            Long existingCourseId = existing == null ? null : existing.getCourse().getId();
            Long requestedCourseId = item.courseId();

            if (Objects.equals(existingCourseId, requestedCourseId)) {
                unchangedCount++;
                continue;
            }

            // SCR-52: Block changing or unassigning an already linked Course once the class has enrollments
            if (existingCourseId != null && enrolledCount > 0) {
                throw new ConflictException(
                        "Không thể đổi hoặc bỏ gán Course của môn " + subject.getCode() + " (" + subject.getName()
                                + ") vì lớp đã có " + enrolledCount + " học viên ghi danh (quy tắc SCR-52)."
                );
            }

            if (requestedCourseId == null) {
                classTopicCourseRepository.delete(existing);
                removedCount++;
                continue;
            }

            Course course = courseRepository.findById(requestedCourseId)
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy Course với ID: " + requestedCourseId));

            if (!Boolean.TRUE.equals(course.getIsActive())) {
                throw new IllegalArgumentException(
                        "Course '" + course.getName() + "' đang ngừng hoạt động (INACTIVE). Chỉ được gán Course ACTIVE."
                );
            }

            if (course.getSubjectId() == null || !Objects.equals(course.getSubjectId(), subject.getId())) {
                throw new IllegalArgumentException(
                        "Course '" + course.getName() + "' không thuộc đúng Topic/môn học "
                                + subject.getCode() + " (" + subject.getName() + ")."
                );
            }

            if (existing == null) {
                ClassTopicCourse link = new ClassTopicCourse();
                link.setClassId(classId);
                link.setProgramSubject(programSubject);
                link.setCourse(course);
                classTopicCourseRepository.save(link);
                assignedCount++;
            } else {
                existing.setCourse(course);
                classTopicCourseRepository.save(existing);
                updatedCount++;
            }
        }

        classTopicCourseRepository.flush();
        ClassProgramSubjectsResponse updatedPlan = toClassProgramSubjects(externalClass, program);
        String message = buildCourseSaveSummaryMessage(externalClass.getCode(), assignedCount, updatedCount, removedCount, unchangedCount);
        return new ClassTopicCoursesSaveResponse(
                classId,
                externalClass.getCode(),
                assignedCount,
                updatedCount,
                removedCount,
                unchangedCount,
                message,
                updatedPlan
        );
    }

    @Override
    public ClassTopicCoursesSaveResponse saveSingleTopicCourse(Long classId, Long programSubjectId, Long courseId) {
        return saveTopicCourses(classId, new ClassTopicCourseSaveRequest(
                List.of(new ClassTopicCourseSaveRequest.TopicCourseItem(programSubjectId, courseId))
        ));
    }

    @Override
    @Transactional(readOnly = true)
    public ClassPlanSummaryResponse getPlanSummary(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Long programId = resolveProgramId(classId, externalClass);
        TrainingProgram program = programId == null ? null : requireProgram(programId);
        ClassProgramSubjectsResponse plan = toClassProgramSubjects(externalClass, program);

        List<ClassPlanSummaryResponse.MissingSubjectItem> missingCourses = new ArrayList<>();
        List<ClassPlanSummaryResponse.MissingSubjectItem> missingAssignments = new ArrayList<>();
        List<ClassPlanSummaryResponse.MissingSubjectItem> missingSchedules = new ArrayList<>();

        int coursesAssignedCount = 0;
        int subjectsWithTrainerCount = 0;
        int subjectsWithScheduleCount = 0;
        int totalScheduledSessions = 0;
        int totalDurationHours = 0;

        for (ClassProgramSubjectsResponse.ProgramSubjectItem item : plan.subjects()) {
            totalDurationHours += item.durationHours() == null ? 0 : item.durationHours();
            totalScheduledSessions += item.scheduledSessionCount();

            ClassPlanSummaryResponse.MissingSubjectItem missingDto = new ClassPlanSummaryResponse.MissingSubjectItem(
                    item.programSubjectId(),
                    item.subjectId(),
                    item.subjectCode(),
                    item.subjectName(),
                    item.subjectVersion(),
                    item.orderIndex(),
                    item.durationHours()
            );

            if (item.course() != null) {
                coursesAssignedCount++;
            } else {
                missingCourses.add(missingDto);
            }

            if (!item.assignments().isEmpty()) {
                subjectsWithTrainerCount++;
            } else {
                missingAssignments.add(missingDto);
            }

            if (item.scheduledSessionCount() > 0) {
                subjectsWithScheduleCount++;
            } else {
                missingSchedules.add(missingDto);
            }
        }

        return new ClassPlanSummaryResponse(
                externalClass.getId(),
                externalClass.getCode(),
                externalClass.getName(),
                externalClass.getStatus(),
                getEnrolledCount(externalClass),
                externalClass.getPlannedSize(),
                program != null,
                program == null ? null : program.getId(),
                program == null ? null : program.getCode(),
                program == null ? null : program.getName(),
                program == null ? null : program.getVersion(),
                plan.subjects().size(),
                totalDurationHours,
                coursesAssignedCount,
                subjectsWithTrainerCount,
                subjectsWithScheduleCount,
                totalScheduledSessions,
                missingCourses,
                missingAssignments,
                missingSchedules,
                plan.programChangeBlocked(),
                plan.programChangeBlockReasons()
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<ClassSubjectOptionResponse> getSubjectOptions(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        Long programId = resolveProgramId(classId, externalClass);
        if (programId == null) {
            return List.of();
        }
        TrainingProgram program = requireProgram(programId);
        Map<Long, Course> courseByPsId = classTopicCourseRepository.findByClassId(classId).stream()
                .collect(Collectors.toMap(item -> item.getProgramSubject().getId(), ClassTopicCourse::getCourse));

        return program.getSubjects().stream()
                .sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                .map(ps -> {
                    Subject subject = ps.getSubject();
                    Course linkedCourse = courseByPsId.get(ps.getId());
                    return new ClassSubjectOptionResponse(
                            ps.getId(),
                            subject.getId(),
                            subject.getCode(),
                            subject.getName(),
                            subject.getVersion(),
                            ps.getOrderIndex(),
                            subject.getDurationHours(),
                            linkedCourse == null ? null : linkedCourse.getId(),
                            linkedCourse == null ? null : linkedCourse.getCode(),
                            linkedCourse == null ? null : linkedCourse.getName()
                    );
                })
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getClassAssignments(Long classId) {
        ExternalClassDTO externalClass = requireClass(classId);
        List<TeachingAssignment> assignments = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId);
        if (assignments.isEmpty()) {
            return List.of();
        }
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        return assignments.stream()
                .map(assignment -> toResponse(assignment, externalClass, trainers.get(assignment.getTrainerId())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getAvailableClassAssignments(Long classId, LocalDate date) {
        LocalDate effectiveOn = date == null ? LocalDate.now() : date;
        ExternalClassDTO externalClass = requireClass(classId);
        List<TeachingAssignment> assignments = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId).stream()
                .filter(assignment -> isEffectiveOn(assignment, effectiveOn))
                .toList();
        if (assignments.isEmpty()) {
            return List.of();
        }
        Map<Long, ExternalTrainerDTO> trainers = fetchTrainerLookup();
        return assignments.stream()
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
        if (page.isEmpty()) {
            return page.map(assignment -> toResponse(assignment, null, null));
        }
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
        Long classId = externalClass.getId();
        int enrolledCount = getEnrolledCount(externalClass);
        ClassProgramSubjectsResponse.ClassContext context = new ClassProgramSubjectsResponse.ClassContext(
                externalClass.getStatus(),
                externalClass.getStartDate(),
                externalClass.getEndDate(),
                externalClass.getSite(),
                externalClass.getLocation(),
                externalClass.getFormatType(),
                externalClass.getPlannedSize(),
                enrolledCount
        );

        List<String> blockReasons = program == null ? List.of() : collectProgramModificationBlockReasons(classId, externalClass);
        boolean programChangeBlocked = !blockReasons.isEmpty();

        if (program == null) {
            return new ClassProgramSubjectsResponse(
                    classId,
                    externalClass.getCode(),
                    externalClass.getName(),
                    context,
                    null,
                    false,
                    List.of(),
                    enrolledCount > 0,
                    List.of()
            );
        }

        List<TeachingAssignment> rawAssignments = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId);
        Map<Long, ExternalTrainerDTO> trainers = rawAssignments.isEmpty() ? Map.of() : fetchTrainerLookupSafely();
        Map<Long, List<TeachingAssignmentResponse>> assignmentsByProgramSubject = rawAssignments.stream()
                .collect(Collectors.groupingBy(assignment -> assignment.getProgramSubject().getId(),
                        Collectors.mapping(assignment -> toResponse(assignment, externalClass,
                                trainers.get(assignment.getTrainerId())), Collectors.toList())));

        Map<Long, Course> linkedCourseByPsId = classTopicCourseRepository.findByClassId(classId).stream()
                .collect(Collectors.toMap(item -> item.getProgramSubject().getId(), ClassTopicCourse::getCourse));

        Map<Long, List<ClassProgramSubjectsResponse.CourseItem>> activeCoursesBySubjectId = courseRepository
                .findByIsActiveTrueOrderByNameAsc().stream()
                .filter(course -> course.getSubjectId() != null)
                .collect(Collectors.groupingBy(
                        Course::getSubjectId,
                        Collectors.mapping(this::toCourseItem, Collectors.toList())
                ));

        List<Session> classSessions = findEffectiveClassSessions(classId);

        List<ClassProgramSubjectsResponse.ProgramSubjectItem> subjects = program.getSubjects().stream()
                .sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                .map(programSubject -> {
                    Subject subject = programSubject.getSubject();
                    List<TeachingAssignmentResponse> subjectAssignments =
                            assignmentsByProgramSubject.getOrDefault(programSubject.getId(), List.of());
                    Set<Long> assignmentIds = subjectAssignments.stream()
                            .map(TeachingAssignmentResponse::id)
                            .collect(Collectors.toSet());

                    List<Session> matchedSessions = classSessions.stream()
                            .filter(s -> matchesSubjectSession(s, subject.getId(), assignmentIds))
                            .toList();
                    int scheduledSessionCount = matchedSessions.size();
                    int completedSessionCount = (int) matchedSessions.stream()
                            .filter(s -> s.getStatus() == Session.SessionStatus.COMPLETED)
                            .count();

                    Course linkedCourse = linkedCourseByPsId.get(programSubject.getId());
                    ClassProgramSubjectsResponse.CourseItem linkedCourseDto = linkedCourse == null ? null : toCourseItem(linkedCourse);
                    boolean courseChangeLocked = linkedCourse != null && enrolledCount > 0;
                    List<ClassProgramSubjectsResponse.CourseItem> availableCourses =
                            activeCoursesBySubjectId.getOrDefault(subject.getId(), List.of());

                    return new ClassProgramSubjectsResponse.ProgramSubjectItem(
                            programSubject.getId(),
                            subject.getId(),
                            subject.getCode(),
                            subject.getName(),
                            subject.getVersion(),
                            subject.getTechnicalGroup(),
                            subject.getDurationHours(),
                            programSubject.getOrderIndex(),
                            linkedCourseDto,
                            courseChangeLocked,
                            availableCourses,
                            subjectAssignments,
                            scheduledSessionCount,
                            completedSessionCount
                    );
                })
                .toList();

        int totalDurationHours = subjects.stream()
                .mapToInt(item -> item.durationHours() == null ? 0 : item.durationHours())
                .sum();

        ClassProgramSubjectsResponse.ProgramSummary summary = new ClassProgramSubjectsResponse.ProgramSummary(
                program.getId(),
                program.getCode(),
                program.getName(),
                program.getVersion(),
                program.getRegion(),
                program.getStatus(),
                totalDurationHours
        );

        return new ClassProgramSubjectsResponse(
                classId,
                externalClass.getCode(),
                externalClass.getName(),
                context,
                summary,
                programChangeBlocked,
                blockReasons,
                enrolledCount > 0,
                subjects
        );
    }

    private List<String> collectProgramModificationBlockReasons(Long classId, ExternalClassDTO externalClass) {
        List<String> reasons = new ArrayList<>();
        int enrolledCount = getEnrolledCount(externalClass);
        if (enrolledCount > 0) {
            reasons.add("đã có " + enrolledCount + " học viên ghi danh (enrollment)");
        }
        long linkedCourses = classTopicCourseRepository.countByClassId(classId);
        if (linkedCourses > 0) {
            reasons.add("đã gán " + linkedCourses + " Course LMS theo Topic");
        }
        long assignmentCount = teachingAssignmentRepository.findByClassIdOrderByEffectiveFromAscIdAsc(classId).size();
        if (assignmentCount > 0) {
            reasons.add("đang có " + assignmentCount + " phân công giảng dạy");
        }
        int sessionCount = findEffectiveClassSessions(classId).size();
        if (sessionCount > 0) {
            reasons.add("đã xếp " + sessionCount + " buổi học trên lịch");
        }
        return reasons;
    }

    private List<Session> findEffectiveClassSessions(Long classId) {
        return sessionRepository.findByClassId(classId).stream()
                .filter(this::isEffectiveSession)
                .toList();
    }

    private boolean isEffectiveSession(Session session) {
        return session != null
                && Boolean.TRUE.equals(session.getIsActive())
                && session.getStatus() != Session.SessionStatus.CANCELLED;
    }

    private boolean matchesSubjectSession(Session session, Long subjectId, Set<Long> assignmentIds) {
        if (session.getTeachingAssignmentId() != null && assignmentIds.contains(session.getTeachingAssignmentId())) {
            return true;
        }
        return Objects.equals(session.getTopicId(), subjectId);
    }

    private int getEnrolledCount(ExternalClassDTO externalClass) {
        return externalClass.getEnrolledCount() == null || externalClass.getEnrolledCount() < 0
                ? 0 : externalClass.getEnrolledCount();
    }

    private ClassProgramSubjectsResponse.CourseItem toCourseItem(Course course) {
        return new ClassProgramSubjectsResponse.CourseItem(
                course.getId(),
                course.getCode(),
                course.getName(),
                course.getInstructor(),
                course.getDescription(),
                Boolean.TRUE.equals(course.getIsActive())
        );
    }

    private String buildCourseSaveSummaryMessage(String classCode, int assigned, int updated, int removed, int unchanged) {
        List<String> parts = new ArrayList<>();
        if (assigned > 0) parts.add("gán mới " + assigned + " Course");
        if (updated > 0) parts.add("đổi " + updated + " Course");
        if (removed > 0) parts.add("bỏ gán " + removed + " Course");
        if (parts.isEmpty()) {
            return "Lớp " + classCode + ": Không có thay đổi Course nào (" + unchanged + " môn giữ nguyên).";
        }
        return "Lớp " + classCode + ": Đã " + String.join(", ", parts) + ".";
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
            throw new IllegalArgumentException("Only active classes can receive program, course, or teaching assignments.");
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

    private Map<Long, ExternalTrainerDTO> fetchTrainerLookupSafely() {
        try {
            return fetchTrainerLookup();
        } catch (ExternalApiException ignored) {
            return Map.of();
        }
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
