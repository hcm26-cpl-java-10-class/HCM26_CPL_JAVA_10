package com.example.starter_project_2025.system.class_setup;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.class_setup.dto.*;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.training_program.*;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class ClassSetupServiceImpl implements ClassSetupService {

    private final TrainingClassRepository trainingClassRepository;
    private final TeachingAssignmentRepository teachingAssignmentRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final TrainingProgramRepository trainingProgramRepository;
    private final ProgramSubjectRepository programSubjectRepository;
    private final SubjectRepository subjectRepository;
    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;

    // =========================================================================
    // 1. Gán phiên bản chương trình đào tạo cho lớp (PUT/PATCH /api/classes/{id}/training-program)
    // =========================================================================

    @Override
    public TrainingClassResponse assignTrainingProgram(Long classId, Long programId) {
        TrainingClass trainingClass = findClassOrThrow(classId);

        TrainingProgram program = trainingProgramRepository.findById(programId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình đào tạo với ID: " + programId));

        if (program.getStatus() != ProgramStatus.ACTIVE) {
            throw new BadRequestException("Chỉ chương trình đào tạo ở trạng thái ACTIVE mới được phép gán cho lớp học.");
        }

        // Cảnh báo/chặn nếu lớp đã có phân công hoặc lịch học
        boolean hasAssignments = teachingAssignmentRepository.existsByClassIdAndIsActiveTrue(classId);
        if (hasAssignments) {
            throw new BadRequestException("Không thể gán chương trình đào tạo mới vì lớp đã có phân công giảng dạy. Vui lòng hủy các phân công trước.");
        }

        List<Session> classSessions = sessionRepository.findByClassId(classId);
        boolean hasActiveSessions = classSessions != null && classSessions.stream()
                .anyMatch(s -> s.getStatus() != Session.SessionStatus.CANCELLED);
        if (hasActiveSessions) {
            throw new BadRequestException("Không thể gán chương trình đào tạo mới vì lớp đã có buổi học được lên lịch.");
        }

        trainingClass.setProgramId(programId);
        TrainingClass saved = trainingClassRepository.save(trainingClass);
        log.info("Gán thành công chương trình đào tạo ID {} cho lớp học {}", programId, saved.getCode());

        return TrainingClassResponse.from(saved, program.getCode(), program.getName(), program.getVersion());
    }

    // =========================================================================
    // 2. Hiển thị danh sách môn học của lớp kèm giảng viên đã phân công (GET /api/classes/{id}/program-subjects)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<ClassProgramSubjectResponse> getClassProgramSubjects(Long classId) {
        TrainingClass trainingClass = findClassOrThrow(classId);

        if (trainingClass.getProgramId() == null) {
            return Collections.emptyList();
        }

        TrainingProgram program = trainingProgramRepository.findById(trainingClass.getProgramId())
                .orElse(null);
        if (program == null) {
            return Collections.emptyList();
        }

        List<ProgramSubject> programSubjects = program.getSubjects();
        if (programSubjects == null || programSubjects.isEmpty()) {
            return Collections.emptyList();
        }

        // Sắp xếp theo orderIndex tăng dần
        List<ProgramSubject> sortedProgramSubjects = programSubjects.stream()
                .sorted(Comparator.comparing(ProgramSubject::getOrderIndex))
                .toList();

        // Lấy tất cả phân công giảng viên đang hoạt động của lớp
        List<TeachingAssignment> assignments = teachingAssignmentRepository.findByClassIdAndIsActiveTrue(classId);
        Map<Long, List<TeachingAssignment>> assignmentMap = assignments.stream()
                .collect(Collectors.groupingBy(TeachingAssignment::getProgramSubjectId));

        // Lấy thông tin môn học gốc từ SubjectRepository
        Set<Long> subjectIds = sortedProgramSubjects.stream()
                .map(ProgramSubject::getSubjectId)
                .collect(Collectors.toSet());
        Map<Long, Subject> subjectMap = subjectRepository.findAllById(subjectIds).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));

        // Lấy thông tin giảng viên từ UserRepository
        Set<Long> trainerIds = assignments.stream()
                .map(TeachingAssignment::getTrainerId)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(trainerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        List<ClassProgramSubjectResponse> result = new ArrayList<>();
        for (ProgramSubject ps : sortedProgramSubjects) {
            Subject subject = subjectMap.get(ps.getSubjectId());
            String subjectCode = subject != null ? subject.getCode() : "UNKNOWN";
            String subjectName = subject != null ? subject.getName() : "Unknown Subject";
            Integer durationHours = subject != null ? subject.getDurationHours() : null;

            List<TeachingAssignment> psAssignments = assignmentMap.getOrDefault(ps.getId(), Collections.emptyList());
            List<ClassProgramSubjectResponse.TrainerAssignmentInfo> trainerInfos = psAssignments.stream().map(a -> {
                User trainer = userMap.get(a.getTrainerId());
                String trainerName = trainer != null ? trainer.getFullName() : ("Trainer #" + a.getTrainerId());
                String trainerEmail = trainer != null ? trainer.getEmail() : null;
                return new ClassProgramSubjectResponse.TrainerAssignmentInfo(
                        a.getId(),
                        a.getTrainerId(),
                        trainerName,
                        trainerEmail,
                        a.getRole(),
                        a.getEffectiveFrom(),
                        a.getEffectiveTo(),
                        a.getIsActive()
                );
            }).toList();

            result.add(new ClassProgramSubjectResponse(
                    ps.getId(),
                    ps.getSubjectId(),
                    subjectCode,
                    subjectName,
                    durationHours,
                    ps.getOrderIndex(),
                    trainerInfos
            ));
        }

        return result;
    }

    // =========================================================================
    // 3. Lấy danh sách phân công giảng viên của lớp (GET /api/classes/{id}/teaching-assignments)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getClassTeachingAssignments(
            Long classId,
            Long programSubjectId,
            Long trainerId,
            AssignmentRole role,
            Boolean activeOnly
    ) {
        TrainingClass trainingClass = findClassOrThrow(classId);

        List<TeachingAssignment> assignments = teachingAssignmentRepository.findByClassIdAndIsActiveTrue(classId);

        LocalDate today = LocalDate.now();

        List<TeachingAssignment> filtered = assignments.stream()
                .filter(a -> programSubjectId == null || a.getProgramSubjectId().equals(programSubjectId))
                .filter(a -> trainerId == null || a.getTrainerId().equals(trainerId))
                .filter(a -> role == null || a.getRole() == role)
                .filter(a -> {
                    if (Boolean.TRUE.equals(activeOnly)) {
                        boolean notStarted = a.getEffectiveFrom().isAfter(today);
                        boolean expired = a.getEffectiveTo() != null && a.getEffectiveTo().isBefore(today);
                        return !notStarted && !expired;
                    }
                    return true;
                })
                .toList();

        return mapToAssignmentResponses(filtered, trainingClass);
    }

    // =========================================================================
    // 4. Gán giảng viên chính/phụ cho môn của lớp (POST /api/teaching-assignments)
    // =========================================================================

    @Override
    public TeachingAssignmentResponse createTeachingAssignment(TeachingAssignmentRequest req) {
        TrainingClass trainingClass = findClassOrThrow(req.classId());

        if (trainingClass.getProgramId() == null) {
            throw new BadRequestException("Lớp học " + trainingClass.getCode() + " chưa được gán chương trình đào tạo.");
        }

        ProgramSubject programSubject = programSubjectRepository.findById(req.programSubjectId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy môn học trong chương trình với ID: " + req.programSubjectId()));

        if (!programSubject.getProgram().getId().equals(trainingClass.getProgramId())) {
            throw new BadRequestException("Môn học được chọn không thuộc chương trình đào tạo của lớp học này.");
        }

        User trainer = userRepository.findById(req.trainerId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giảng viên với ID: " + req.trainerId()));

        if (!Boolean.TRUE.equals(trainer.getIsActive())) {
            throw new BadRequestException("Giảng viên " + trainer.getFullName() + " hiện đã ngừng hoạt động trong hệ thống.");
        }

        validateEffectiveDates(req.effectiveFrom(), req.effectiveTo(), trainingClass);

        // Chặn trùng phân công (cùng lớp, môn, giảng viên, giao khoảng thời gian)
        List<TeachingAssignment> overlaps = teachingAssignmentRepository.findOverlappingAssignments(
                req.classId(),
                req.programSubjectId(),
                req.trainerId(),
                req.effectiveFrom(),
                req.effectiveTo(),
                null
        );
        if (!overlaps.isEmpty()) {
            throw new BadRequestException("Giảng viên " + trainer.getFullName() + " đã có phân công cho môn học này trong khoảng thời gian bị trùng lặp.");
        }

        TeachingAssignment assignment = TeachingAssignment.builder()
                .classId(req.classId())
                .programSubjectId(req.programSubjectId())
                .trainerId(req.trainerId())
                .role(req.role())
                .effectiveFrom(req.effectiveFrom())
                .effectiveTo(req.effectiveTo())
                .isActive(true)
                .build();

        TeachingAssignment saved = teachingAssignmentRepository.save(assignment);
        log.info("Tạo phân công giảng dạy ID {} thành công cho lớp {}", saved.getId(), trainingClass.getCode());

        Subject subject = subjectRepository.findById(programSubject.getSubjectId()).orElse(null);
        String subjectCode = subject != null ? subject.getCode() : "";
        String subjectName = subject != null ? subject.getName() : "";

        return new TeachingAssignmentResponse(
                saved.getId(),
                trainingClass.getId(),
                trainingClass.getCode(),
                programSubject.getId(),
                programSubject.getSubjectId(),
                subjectCode,
                subjectName,
                programSubject.getOrderIndex(),
                trainer.getId(),
                trainer.getFullName(),
                trainer.getEmail(),
                saved.getRole(),
                saved.getEffectiveFrom(),
                saved.getEffectiveTo(),
                saved.getIsActive()
        );
    }

    // =========================================================================
    // 5. Cập nhật phân công giảng dạy (PUT /api/teaching-assignments/{id})
    // =========================================================================

    @Override
    public TeachingAssignmentResponse updateTeachingAssignment(Long id, UpdateTeachingAssignmentRequest req) {
        TeachingAssignment assignment = teachingAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phân công giảng dạy với ID: " + id));

        TrainingClass trainingClass = findClassOrThrow(assignment.getClassId());

        User trainer = userRepository.findById(req.trainerId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy giảng viên với ID: " + req.trainerId()));

        if (!Boolean.TRUE.equals(trainer.getIsActive())) {
            throw new BadRequestException("Giảng viên " + trainer.getFullName() + " hiện đã ngừng hoạt động.");
        }

        validateEffectiveDates(req.effectiveFrom(), req.effectiveTo(), trainingClass);

        // Chặn trùng phân công (loại trừ chính id này)
        List<TeachingAssignment> overlaps = teachingAssignmentRepository.findOverlappingAssignments(
                assignment.getClassId(),
                assignment.getProgramSubjectId(),
                req.trainerId(),
                req.effectiveFrom(),
                req.effectiveTo(),
                id
        );
        if (!overlaps.isEmpty()) {
            throw new BadRequestException("Giảng viên đã có phân công cho môn học này trong khoảng thời gian bị trùng lặp.");
        }

        // Kiểm tra các StudySession đã xếp của Danh:
        // Cảnh báo nếu thu hẹp effectiveFrom/effectiveTo làm buổi học đã xếp bị rơi ra ngoài khoảng hiệu lực
        List<Session> classSessions = sessionRepository.findByClassId(assignment.getClassId());
        if (classSessions != null) {
            for (Session s : classSessions) {
                if (s.getStatus() != Session.SessionStatus.CANCELLED &&
                        assignment.getTrainerId().equals(s.getTrainerId())) {
                    LocalDate sessionDate = s.getStartTime().toLocalDate();
                    if (sessionDate.isBefore(req.effectiveFrom()) ||
                            (req.effectiveTo() != null && sessionDate.isAfter(req.effectiveTo()))) {
                        throw new BadRequestException(
                                "Không thể thu hẹp thời hạn hiệu lực vì buổi học '" + s.getTitle() +
                                "' vào ngày " + sessionDate + " bị rơi ra ngoài khoảng thời gian hiệu lực mới."
                        );
                    }
                }
            }
        }

        assignment.setTrainerId(req.trainerId());
        assignment.setRole(req.role());
        assignment.setEffectiveFrom(req.effectiveFrom());
        assignment.setEffectiveTo(req.effectiveTo());

        TeachingAssignment saved = teachingAssignmentRepository.save(assignment);
        log.info("Cập nhật phân công giảng dạy ID {} thành công", saved.getId());

        ProgramSubject programSubject = programSubjectRepository.findById(saved.getProgramSubjectId()).orElse(null);
        Subject subject = programSubject != null ? subjectRepository.findById(programSubject.getSubjectId()).orElse(null) : null;

        return new TeachingAssignmentResponse(
                saved.getId(),
                trainingClass.getId(),
                trainingClass.getCode(),
                programSubject != null ? programSubject.getId() : saved.getProgramSubjectId(),
                programSubject != null ? programSubject.getSubjectId() : null,
                subject != null ? subject.getCode() : "",
                subject != null ? subject.getName() : "",
                programSubject != null ? programSubject.getOrderIndex() : 0,
                trainer.getId(),
                trainer.getFullName(),
                trainer.getEmail(),
                saved.getRole(),
                saved.getEffectiveFrom(),
                saved.getEffectiveTo(),
                saved.getIsActive()
        );
    }

    // =========================================================================
    // 6. Bỏ / Ngừng phân công giảng dạy (DELETE /api/teaching-assignments/{id})
    // =========================================================================

    @Override
    public void deleteTeachingAssignment(Long id) {
        TeachingAssignment assignment = teachingAssignmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy phân công giảng dạy với ID: " + id));

        // Kiểm tra xem đã có buổi học nào tham chiếu phân công này chưa
        List<Session> classSessions = sessionRepository.findByClassId(assignment.getClassId());
        if (classSessions != null) {
            boolean hasFutureSessions = classSessions.stream()
                    .anyMatch(s -> s.getStatus() != Session.SessionStatus.CANCELLED &&
                            assignment.getTrainerId().equals(s.getTrainerId()) &&
                            s.getStartTime().toLocalDate().isAfter(LocalDate.now().minusDays(1)));
            if (hasFutureSessions) {
                throw new BadRequestException("Không thể xóa phân công giảng dạy vì đã có buổi học được lên lịch. Vui lòng hủy các buổi học trước hoặc kết thúc thời hạn hiệu lực.");
            }
        }

        // Thực hiện soft-delete hoặc xóa
        assignment.setIsActive(false);
        assignment.setEffectiveTo(LocalDate.now());
        teachingAssignmentRepository.save(assignment);
        log.info("Ngừng phân công giảng dạy ID {}", id);
    }

    // =========================================================================
    // 7. Bàn giao cho Danh: Phân công còn hiệu lực tại một ngày cụ thể (GET /api/classes/{id}/teaching-assignments/available)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<AvailableAssignmentResponse> getAvailableAssignments(Long classId, LocalDate date) {
        TrainingClass trainingClass = findClassOrThrow(classId);
        LocalDate targetDate = date != null ? date : LocalDate.now();

        List<TeachingAssignment> assignments = teachingAssignmentRepository.findAvailableAssignments(classId, targetDate);

        Set<Long> programSubjectIds = assignments.stream()
                .map(TeachingAssignment::getProgramSubjectId)
                .collect(Collectors.toSet());
        Map<Long, ProgramSubject> psMap = programSubjectRepository.findAllById(programSubjectIds).stream()
                .collect(Collectors.toMap(ProgramSubject::getId, ps -> ps));

        Set<Long> subjectIds = psMap.values().stream()
                .map(ProgramSubject::getSubjectId)
                .collect(Collectors.toSet());
        Map<Long, Subject> subjectMap = subjectRepository.findAllById(subjectIds).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));

        Set<Long> trainerIds = assignments.stream()
                .map(TeachingAssignment::getTrainerId)
                .collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(trainerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return assignments.stream().map(a -> {
            ProgramSubject ps = psMap.get(a.getProgramSubjectId());
            Subject subject = ps != null ? subjectMap.get(ps.getSubjectId()) : null;
            User trainer = userMap.get(a.getTrainerId());

            return new AvailableAssignmentResponse(
                    a.getId(),
                    trainingClass.getId(),
                    trainingClass.getCode(),
                    ps != null ? ps.getId() : a.getProgramSubjectId(),
                    ps != null ? ps.getSubjectId() : null,
                    subject != null ? subject.getCode() : "",
                    subject != null ? subject.getName() : "",
                    ps != null ? ps.getOrderIndex() : 0,
                    a.getTrainerId(),
                    trainer != null ? trainer.getFullName() : ("Trainer #" + a.getTrainerId()),
                    trainer != null ? trainer.getEmail() : null,
                    a.getRole(),
                    a.getEffectiveFrom(),
                    a.getEffectiveTo()
            );
        }).toList();
    }

    // =========================================================================
    // 8. Bàn giao cho Tân: Lịch giảng dạy theo trainerId (GET /api/teaching-assignments?trainerId=...)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<TeachingAssignmentResponse> getAssignmentsByTrainer(Long trainerId) {
        List<TeachingAssignment> assignments = teachingAssignmentRepository.findByTrainerIdAndIsActiveTrue(trainerId);
        if (assignments.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> classIds = assignments.stream().map(TeachingAssignment::getClassId).collect(Collectors.toSet());
        Map<Long, TrainingClass> classMap = trainingClassRepository.findAllById(classIds).stream()
                .collect(Collectors.toMap(TrainingClass::getId, c -> c));

        Set<Long> programSubjectIds = assignments.stream().map(TeachingAssignment::getProgramSubjectId).collect(Collectors.toSet());
        Map<Long, ProgramSubject> psMap = programSubjectRepository.findAllById(programSubjectIds).stream()
                .collect(Collectors.toMap(ProgramSubject::getId, ps -> ps));

        Set<Long> subjectIds = psMap.values().stream().map(ProgramSubject::getSubjectId).collect(Collectors.toSet());
        Map<Long, Subject> subjectMap = subjectRepository.findAllById(subjectIds).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));

        User trainer = userRepository.findById(trainerId).orElse(null);
        String trainerName = trainer != null ? trainer.getFullName() : ("Trainer #" + trainerId);
        String trainerEmail = trainer != null ? trainer.getEmail() : null;

        return assignments.stream().map(a -> {
            TrainingClass c = classMap.get(a.getClassId());
            ProgramSubject ps = psMap.get(a.getProgramSubjectId());
            Subject s = ps != null ? subjectMap.get(ps.getSubjectId()) : null;

            return new TeachingAssignmentResponse(
                    a.getId(),
                    a.getClassId(),
                    c != null ? c.getCode() : "",
                    a.getProgramSubjectId(),
                    ps != null ? ps.getSubjectId() : null,
                    s != null ? s.getCode() : "",
                    s != null ? s.getName() : "",
                    ps != null ? ps.getOrderIndex() : 0,
                    a.getTrainerId(),
                    trainerName,
                    trainerEmail,
                    a.getRole(),
                    a.getEffectiveFrom(),
                    a.getEffectiveTo(),
                    a.getIsActive()
            );
        }).toList();
    }

    // =========================================================================
    // 9. Quản lý Lớp học (CRUD TrainingClass)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public Page<TrainingClassResponse> searchClasses(String keyword, ClassStatus status, Pageable pageable) {
        Page<TrainingClass> page = trainingClassRepository.findAll((root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (keyword != null && !keyword.isBlank()) {
                String pattern = "%" + keyword.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("code")), pattern),
                        cb.like(cb.lower(root.get("name")), pattern)
                ));
            }
            if (status != null) {
                predicates.add(cb.equal(root.get("status"), status));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        }, pageable);

        Set<Long> programIds = page.getContent().stream()
                .map(TrainingClass::getProgramId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, TrainingProgram> programMap = programIds.isEmpty()
                ? Collections.emptyMap()
                : trainingProgramRepository.findAllById(programIds).stream()
                .collect(Collectors.toMap(TrainingProgram::getId, p -> p));

        return page.map(c -> {
            TrainingProgram prog = c.getProgramId() != null ? programMap.get(c.getProgramId()) : null;
            return TrainingClassResponse.from(
                    c,
                    prog != null ? prog.getCode() : null,
                    prog != null ? prog.getName() : null,
                    prog != null ? prog.getVersion() : null
            );
        });
    }

    @Override
    @Transactional(readOnly = true)
    public TrainingClassResponse getClassById(Long id) {
        TrainingClass c = findClassOrThrow(id);
        TrainingProgram prog = c.getProgramId() != null
                ? trainingProgramRepository.findById(c.getProgramId()).orElse(null)
                : null;
        return TrainingClassResponse.from(
                c,
                prog != null ? prog.getCode() : null,
                prog != null ? prog.getName() : null,
                prog != null ? prog.getVersion() : null
        );
    }

    @Override
    public TrainingClassResponse createClass(TrainingClassRequest req) {
        if (trainingClassRepository.existsByCode(req.code().trim())) {
            throw new BadRequestException("Mã lớp học '" + req.code() + "' đã tồn tại.");
        }

        if (req.startDate() != null && req.endDate() != null && req.startDate().isAfter(req.endDate())) {
            throw new BadRequestException("Ngày bắt đầu lớp học không được sau ngày kết thúc.");
        }

        TrainingProgram program = null;
        if (req.programId() != null) {
            program = trainingProgramRepository.findById(req.programId())
                    .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình đào tạo với ID: " + req.programId()));
            if (program.getStatus() != ProgramStatus.ACTIVE) {
                throw new BadRequestException("Chỉ chương trình đào tạo ở trạng thái ACTIVE mới được phép gán cho lớp học.");
            }
        }

        TrainingClass c = TrainingClass.builder()
                .code(req.code().trim())
                .name(req.name().trim())
                .programId(req.programId())
                .startDate(req.startDate())
                .endDate(req.endDate())
                .status(req.status() != null ? req.status() : ClassStatus.PLANNING)
                .plannedSize(req.plannedSize())
                .isActive(true)
                .build();

        TrainingClass saved = trainingClassRepository.save(c);
        log.info("Tạo lớp học mới: {} (ID: {})", saved.getCode(), saved.getId());

        return TrainingClassResponse.from(
                saved,
                program != null ? program.getCode() : null,
                program != null ? program.getName() : null,
                program != null ? program.getVersion() : null
        );
    }

    @Override
    public TrainingClassResponse updateClass(Long id, TrainingClassRequest req) {
        TrainingClass c = findClassOrThrow(id);

        if (!c.getCode().equalsIgnoreCase(req.code().trim()) && trainingClassRepository.existsByCode(req.code().trim())) {
            throw new BadRequestException("Mã lớp học '" + req.code() + "' đã tồn tại.");
        }

        if (req.startDate() != null && req.endDate() != null && req.startDate().isAfter(req.endDate())) {
            throw new BadRequestException("Ngày bắt đầu lớp học không được sau ngày kết thúc.");
        }

        c.setCode(req.code().trim());
        c.setName(req.name().trim());
        c.setStartDate(req.startDate());
        c.setEndDate(req.endDate());
        if (req.status() != null) c.setStatus(req.status());
        if (req.plannedSize() != null) c.setPlannedSize(req.plannedSize());

        TrainingClass saved = trainingClassRepository.save(c);
        TrainingProgram prog = saved.getProgramId() != null ? trainingProgramRepository.findById(saved.getProgramId()).orElse(null) : null;

        return TrainingClassResponse.from(
                saved,
                prog != null ? prog.getCode() : null,
                prog != null ? prog.getName() : null,
                prog != null ? prog.getVersion() : null
        );
    }

    // =========================================================================
    // 10. Ghi danh học viên (Enrollment - Bàn giao cho Tân & Hệ thống)
    // =========================================================================

    @Override
    @Transactional(readOnly = true)
    public List<EnrollmentResponse> getEnrollmentsByClassId(Long classId) {
        findClassOrThrow(classId);
        List<Enrollment> enrollments = enrollmentRepository.findByClassId(classId);
        if (enrollments.isEmpty()) {
            return Collections.emptyList();
        }

        Set<Long> studentIds = enrollments.stream().map(Enrollment::getStudentId).collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(studentIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        TrainingClass c = findClassOrThrow(classId);

        return enrollments.stream().map(e -> {
            User student = userMap.get(e.getStudentId());
            return new EnrollmentResponse(
                    e.getId(),
                    e.getStudentId(),
                    student != null ? student.getFullName() : ("Student #" + e.getStudentId()),
                    student != null ? student.getEmail() : null,
                    classId,
                    c.getCode(),
                    e.getEnrolledAt(),
                    e.getStatus(),
                    e.getIsActive(),
                    e.getCreatedAt()
            );
        }).toList();
    }

    @Override
    public EnrollmentResponse enrollStudent(Long classId, EnrollmentRequest req) {
        TrainingClass c = findClassOrThrow(classId);

        User student = userRepository.findById(req.studentId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy học viên với ID: " + req.studentId()));

        Optional<Enrollment> existing = enrollmentRepository.findByClassIdAndStudentId(classId, req.studentId());
        if (existing.isPresent()) {
            throw new BadRequestException("Học viên " + student.getFullName() + " đã được ghi danh vào lớp này.");
        }

        Enrollment enrollment = Enrollment.builder()
                .classId(classId)
                .studentId(req.studentId())
                .enrolledAt(req.enrolledAt() != null ? req.enrolledAt() : LocalDate.now())
                .status(req.status() != null ? req.status() : EnrollmentStatus.ENROLLED)
                .isActive(true)
                .build();

        Enrollment saved = enrollmentRepository.save(enrollment);
        log.info("Ghi danh học viên {} vào lớp {}", student.getFullName(), c.getCode());

        return new EnrollmentResponse(
                saved.getId(),
                saved.getStudentId(),
                student.getFullName(),
                student.getEmail(),
                classId,
                c.getCode(),
                saved.getEnrolledAt(),
                saved.getStatus(),
                saved.getIsActive(),
                saved.getCreatedAt()
        );
    }

    // =========================================================================
    // Helper Methods
    // =========================================================================

    private TrainingClass findClassOrThrow(Long classId) {
        return trainingClassRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp học với ID: " + classId));
    }

    private void validateEffectiveDates(LocalDate from, LocalDate to, TrainingClass trainingClass) {
        if (from == null) {
            throw new BadRequestException("Ngày bắt đầu hiệu lực (effectiveFrom) không được để trống.");
        }
        if (to != null && from.isAfter(to)) {
            throw new BadRequestException("Ngày bắt đầu hiệu lực (" + from + ") không được sau ngày kết thúc (" + to + ").");
        }
        if (trainingClass.getStartDate() != null && from.isBefore(trainingClass.getStartDate())) {
            throw new BadRequestException("Ngày bắt đầu hiệu lực (" + from + ") không được trước ngày bắt đầu của lớp học (" + trainingClass.getStartDate() + ").");
        }
        if (trainingClass.getEndDate() != null && to != null && to.isAfter(trainingClass.getEndDate())) {
            throw new BadRequestException("Ngày kết thúc hiệu lực (" + to + ") không được vượt quá ngày kết thúc của lớp học (" + trainingClass.getEndDate() + ").");
        }
    }

    private List<TeachingAssignmentResponse> mapToAssignmentResponses(List<TeachingAssignment> assignments, TrainingClass trainingClass) {
        if (assignments.isEmpty()) return Collections.emptyList();

        Set<Long> programSubjectIds = assignments.stream().map(TeachingAssignment::getProgramSubjectId).collect(Collectors.toSet());
        Map<Long, ProgramSubject> psMap = programSubjectRepository.findAllById(programSubjectIds).stream()
                .collect(Collectors.toMap(ProgramSubject::getId, ps -> ps));

        Set<Long> subjectIds = psMap.values().stream().map(ProgramSubject::getSubjectId).collect(Collectors.toSet());
        Map<Long, Subject> subjectMap = subjectRepository.findAllById(subjectIds).stream()
                .collect(Collectors.toMap(Subject::getId, s -> s));

        Set<Long> trainerIds = assignments.stream().map(TeachingAssignment::getTrainerId).collect(Collectors.toSet());
        Map<Long, User> userMap = userRepository.findAllById(trainerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        return assignments.stream().map(a -> {
            ProgramSubject ps = psMap.get(a.getProgramSubjectId());
            Subject s = ps != null ? subjectMap.get(ps.getSubjectId()) : null;
            User trainer = userMap.get(a.getTrainerId());

            return new TeachingAssignmentResponse(
                    a.getId(),
                    trainingClass.getId(),
                    trainingClass.getCode(),
                    ps != null ? ps.getId() : a.getProgramSubjectId(),
                    ps != null ? ps.getSubjectId() : null,
                    s != null ? s.getCode() : "",
                    s != null ? s.getName() : "",
                    ps != null ? ps.getOrderIndex() : 0,
                    a.getTrainerId(),
                    trainer != null ? trainer.getFullName() : ("Trainer #" + a.getTrainerId()),
                    trainer != null ? trainer.getEmail() : null,
                    a.getRole(),
                    a.getEffectiveFrom(),
                    a.getEffectiveTo(),
                    a.getIsActive()
            );
        }).toList();
    }
}
