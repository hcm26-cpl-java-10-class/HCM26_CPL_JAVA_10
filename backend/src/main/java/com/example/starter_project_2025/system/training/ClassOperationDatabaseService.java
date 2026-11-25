package com.example.starter_project_2025.system.training;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import com.example.starter_project_2025.system.training.entity.ClassActivityEntity;
import com.example.starter_project_2025.system.training.entity.ClassAttendanceEntity;
import com.example.starter_project_2025.system.training.entity.ClassOperationEntity;
import com.example.starter_project_2025.system.training.entity.ClassTopicAssessmentEntity;
import com.example.starter_project_2025.system.training.entity.ClassTopicMarkEntity;
import com.example.starter_project_2025.system.training.entity.ClassTopicMarkLockEntity;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgram;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.ProgramSubject;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClassOperationDatabaseService {

    private final ClassOperationRepository operationRepository;
    private final ClassTopicAssessmentRepository topicAssessmentRepository;
    private final ClassTopicMarkRepository topicMarkRepository;
    private final ClassTopicMarkLockRepository topicMarkLockRepository;
    private final ClassActivityEntityRepository activityRepository;
    private final ClassAttendanceRepository attendanceRepository;
    private final ClassEnrollmentRepository enrollmentRepository;
    private final MasterTraineeDirectory masterTraineeDirectory;
    private final TrainingClassRepository trainingClassRepository;
    private final SessionRepository sessionRepository;
    private final ClassTrainingProgramRepository classTrainingProgramRepository;
    private final SubjectRepository subjectRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock trainingClassClock;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter MONTH_LABEL_FMT = DateTimeFormatter.ofPattern("MMM - yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter ACTIVITY_TS_FMT = DateTimeFormatter.ofPattern("dd-MMM-yyyy HH:mm:ss", Locale.ENGLISH);

    private TrainingClass getTrainingClassOrFallback(Long classId) {
        return trainingClassRepository.findById(classId)
                .orElseGet(() -> {
                    TrainingClass tc = new TrainingClass();
                    tc.setId(classId);
                    tc.setCode("CLASS_" + classId);
                    tc.setName("Class " + classId);
                    tc.setStatus("active");
                    tc.setStartDate(LocalDate.now());
                    tc.setEndDate(LocalDate.now().plusMonths(3));
                    tc.setPlannedSize(25);
                    return trainingClassRepository.save(tc);
                });
    }

    // =========================================================================
    // 0. BASELINE CLASSES & TRAINEE ENROLLMENTS SEED (H2 DATABASE)
    // =========================================================================

    @Transactional
    public List<TrainingClass> ensureDefaultTrainingClassesInH2() {
        if (trainingClassRepository.count() > 0) {
            return trainingClassRepository.findAll();
        }
        List<TrainingClass> defaults = List.of(
                buildDefaultTrainingClass(
                        "LOCAL_JAVA_01",
                        "Lớp Chuyên sâu Java Backend (K26)",
                        LocalDate.of(2026, 10, 1),
                        LocalDate.of(2027, 1, 31),
                        25,
                        "LOCAL_JAVA",
                        "Nguyễn Ngọc Tân (Trainer)",
                        "Offline",
                        "Java, Spring Boot",
                        "Phòng Lab 201 (F-Town 2)"
                ),
                buildDefaultTrainingClass(
                        "LOCAL_JAVA_02",
                        "Lớp Lập trình Fullstack Java Web (K26)",
                        LocalDate.of(2026, 11, 15),
                        LocalDate.of(2027, 3, 15),
                        30,
                        "LOCAL_FULLSTACK",
                        "Nguyễn Mạnh Hoàng (Trainer)",
                        "Hybrid",
                        "Java, React",
                        "Phòng 304 (Innovation Hall)"
                )
        );
        return trainingClassRepository.saveAll(defaults);
    }

    @Transactional
    public List<ClassEnrollment> initializeEnrollmentsFromH2(TrainingClass tc) {
        if (tc == null || tc.getId() == null) {
            return List.of();
        }
        if (enrollmentRepository.countByTrainingClass_Id(tc.getId()) > 0) {
            return enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(tc.getId());
        }

        List<MasterTraineeDirectory.Profile> seedProfiles = switch (tc.getCode() != null ? tc.getCode() : "") {
            case "LOCAL_JAVA_01" -> MasterTraineeDirectory.CLASS_1_SEED_PROFILES;
            case "LOCAL_JAVA_02" -> MasterTraineeDirectory.CLASS_2_SEED_PROFILES;
            default -> List.of();
        };
        if (seedProfiles.isEmpty()) {
            return List.of();
        }

        int cap = tc.getPlannedSize() != null && tc.getPlannedSize() > 0
                ? tc.getPlannedSize()
                : seedProfiles.size();

        List<ClassEnrollment> toSave = new ArrayList<>();
        for (int i = 0; i < Math.min(cap, seedProfiles.size()); i++) {
            MasterTraineeDirectory.Profile p = seedProfiles.get(i);
            ClassEnrollment enrollment = new ClassEnrollment();
            enrollment.setTrainingClass(tc);
            enrollment.setTraineeId(p.id());
            enrollment.setStudentId(p.studentId());
            enrollment.setFullName(p.fullName());
            enrollment.setPersonalEmail(p.personalEmail());
            enrollment.setDob(p.dob());
            enrollment.setGender(p.gender());
            enrollment.setStatus(ClassEnrollment.Status.ACTIVE);
            enrollment.setIsActive(true);
            toSave.add(enrollment);
        }
        return enrollmentRepository.saveAll(toSave);
    }

    private TrainingClass buildDefaultTrainingClass(
            String code,
            String name,
            LocalDate startDate,
            LocalDate endDate,
            int plannedSize,
            String program,
            String masterTrainer,
            String formatType,
            String skills,
            String location
    ) {
        TrainingClass tc = new TrainingClass();
        tc.setCode(code);
        tc.setName(name);
        tc.setStatus("active");
        tc.setStartDate(startDate);
        tc.setEndDate(endDate);
        tc.setPlannedSize(plannedSize);
        tc.setSite("TP. Hồ Chí Minh");
        tc.setTraineeType("Fresher");
        tc.setProgram(program);
        tc.setClassAdmin("admin@example.com");
        tc.setMasterTrainer(masterTrainer);
        tc.setDeliveryType("Class");
        tc.setFormatType(formatType);
        tc.setSkills(skills);
        tc.setLocation(location);
        tc.setIsActive(true);
        return tc;
    }

    // =========================================================================
    // 1. OPERATION & MILESTONES (QUERYING & PERSISTING IN H2 DATABASE)
    // =========================================================================

    @Transactional
    public Map<String, Object> getOperation(Long classId) {
        ClassOperationEntity entity = operationRepository.findByTrainingClass_Id(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));
        return toOperationMap(entity);
    }

    @Transactional
    public Map<String, Object> saveOperation(Long classId, Map<String, Object> body) {
        ClassOperationEntity entity = operationRepository.findByTrainingClass_Id(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));

        Map<String, Object> opInfo = (Map<String, Object>) body.get("operatingInfo");
        if (opInfo != null) {
            if (opInfo.get("actualStartDate") != null) entity.setActualStartDate(String.valueOf(opInfo.get("actualStartDate")));
            if (opInfo.get("earlyGraduatedDate") != null) entity.setEarlyGraduatedDate(String.valueOf(opInfo.get("earlyGraduatedDate")));
            if (opInfo.get("actualEndDate") != null) entity.setActualEndDate(String.valueOf(opInfo.get("actualEndDate")));
            if (opInfo.get("hasNoAllocationNeeds") != null) {
                entity.setHasNoAllocationNeeds(Boolean.parseBoolean(String.valueOf(opInfo.get("hasNoAllocationNeeds"))));
            }

            Map<String, Object> gpa = (Map<String, Object>) opInfo.get("gpaCalculation");
            if (gpa != null) {
                if (gpa.get("topicMark") != null) entity.setTopicMark(Integer.parseInt(String.valueOf(gpa.get("topicMark"))));
                if (gpa.get("disciplinePoint") != null) entity.setDisciplinePoint(Integer.parseInt(String.valueOf(gpa.get("disciplinePoint"))));
                if (gpa.get("bonusPoint") != null) entity.setBonusPoint(Integer.parseInt(String.valueOf(gpa.get("bonusPoint"))));
                if (gpa.get("penaltyPoint") != null) entity.setPenaltyPoint(Integer.parseInt(String.valueOf(gpa.get("penaltyPoint"))));
            }
        }

        Object milestones = body.get("milestones");
        if (milestones != null) {
            try {
                entity.setMilestonesJson(objectMapper.writeValueAsString(milestones));
            } catch (Exception e) {
                log.error("Failed to serialize milestones to JSON", e);
            }
        }

        if (body.get("totalWeightedNumber") != null) {
            entity.setTotalWeightedNumber(Integer.parseInt(String.valueOf(body.get("totalWeightedNumber"))));
        }

        ClassOperationEntity saved = operationRepository.save(entity);
        return toOperationMap(saved);
    }

    // =========================================================================
    // 2. TOPIC ASSESSMENTS CONFIGURATION (H2 DATABASE)
    // =========================================================================

    @Transactional
    public List<Map<String, Object>> getTopicAssessments(Long classId) {
        List<ClassTopicAssessmentEntity> list = topicAssessmentRepository.findByTrainingClass_IdOrderByTopicIndexAsc(classId);
        if (list.isEmpty()) {
            list = initializeTopicAssessmentsFromH2(classId);
        }
        return list.stream().map(this::toTopicMap).toList();
    }

    @Transactional
    public List<Map<String, Object>> saveTopicAssessments(Long classId, Map<String, Object> body) {
        String action = body.get("action") != null ? String.valueOf(body.get("action")) : "confirm";
        List<Map<String, Object>> incomingTopics = (List<Map<String, Object>>) body.get("topics");
        if (incomingTopics == null) {
            return getTopicAssessments(classId);
        }

        List<ClassTopicAssessmentEntity> existingList = topicAssessmentRepository.findByTrainingClass_IdOrderByTopicIndexAsc(classId);
        Map<Integer, ClassTopicAssessmentEntity> existingByIndex = new HashMap<>();
        for (ClassTopicAssessmentEntity existing : existingList) {
            if (existing.getTopicIndex() != null) {
                existingByIndex.put(existing.getTopicIndex(), existing);
            }
        }

        List<ClassTopicAssessmentEntity> updatedEntities = new ArrayList<>();
        int index = 1;
        TrainingClass tc = getTrainingClassOrFallback(classId);
        for (Map<String, Object> t : incomingTopics) {
            String title = (String) t.get("title");
            List<Map<String, Object>> assessments = (List<Map<String, Object>>) t.get("assessments");
            if (assessments == null) assessments = new ArrayList<>();

            for (Map<String, Object> a : assessments) {
                String currentStatus = (String) a.get("changeStatus");
                if ("confirm".equalsIgnoreCase(action)) {
                    if ("waiting".equalsIgnoreCase(currentStatus)) {
                        a.put("changeStatus", "confirmed");
                    }
                } else if ("reject".equalsIgnoreCase(action)) {
                    a.put("changeStatus", "none");
                }
            }

            String json;
            try {
                json = objectMapper.writeValueAsString(assessments);
            } catch (Exception e) {
                json = "[]";
            }

            ClassTopicAssessmentEntity entity = existingByIndex.get(index);
            if (entity == null) {
                entity = ClassTopicAssessmentEntity.builder()
                        .trainingClass(tc)
                        .topicIndex(index)
                        .title(title)
                        .assessmentsJson(json)
                        .build();
            } else {
                entity.setTitle(title);
                entity.setAssessmentsJson(json);
            }

            updatedEntities.add(topicAssessmentRepository.save(entity));
            index++;
        }

        if ("confirm".equalsIgnoreCase(action)) {
            syncMilestoneWeightsWithTopicAssessments(classId, incomingTopics);
        }
        recalculateTopicMarksForUpdatedSchema(classId);

        return updatedEntities.stream().map(this::toTopicMap).toList();
    }

    private void syncMilestoneWeightsWithTopicAssessments(Long classId, List<Map<String, Object>> incomingTopics) {
        ClassOperationEntity opEntity = operationRepository.findByTrainingClass_Id(classId)
                .orElseGet(() -> initializeOperationFromH2(classId));
        if (opEntity.getMilestonesJson() == null || opEntity.getMilestonesJson().isBlank()) {
            return;
        }

        Map<String, Double> topicCodePercentMap = new HashMap<>();
        for (Map<String, Object> t : incomingTopics) {
            String title = t.get("title") != null ? String.valueOf(t.get("title")) : "";
            List<Map<String, Object>> assessments = (List<Map<String, Object>>) t.get("assessments");
            double sumPercent = 0;
            if (assessments != null) {
                for (Map<String, Object> a : assessments) {
                    Object w = a.get("weightedNumber");
                    if (w != null) {
                        try {
                            sumPercent += Double.parseDouble(String.valueOf(w));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
            String code = extractTopicCode(title);
            if (!code.isEmpty()) {
                topicCodePercentMap.put(code, sumPercent);
            }
        }

        try {
            List<Map<String, Object>> milestones = objectMapper.readValue(
                    opEntity.getMilestonesJson(),
                    new TypeReference<List<Map<String, Object>>>() {}
            );
            int newTotalWeighted = 0;
            for (Map<String, Object> m : milestones) {
                List<Map<String, Object>> mTopics = (List<Map<String, Object>>) m.get("topics");
                if (mTopics == null) continue;
                for (Map<String, Object> mt : mTopics) {
                    String mTopicName = mt.get("topic") != null ? String.valueOf(mt.get("topic")) : "";
                    int currentWeight = mt.get("weightedNumber") != null
                            ? Integer.parseInt(String.valueOf(mt.get("weightedNumber")))
                            : 0;
                    int baseWeight = mt.get("baseWeightedNumber") != null
                            ? Integer.parseInt(String.valueOf(mt.get("baseWeightedNumber")))
                            : currentWeight;
                    mt.put("baseWeightedNumber", baseWeight);

                    String code = extractTopicCode(mTopicName);
                    if (topicCodePercentMap.containsKey(code)) {
                        double pct = topicCodePercentMap.get(code);
                        int updatedWeight = (int) Math.round(baseWeight * (pct / 100.0));
                        mt.put("weightedNumber", updatedWeight);
                        newTotalWeighted += updatedWeight;
                    } else {
                        newTotalWeighted += currentWeight;
                    }
                }
            }
            opEntity.setMilestonesJson(objectMapper.writeValueAsString(milestones));
            opEntity.setTotalWeightedNumber(newTotalWeighted);
            operationRepository.save(opEntity);
        } catch (Exception e) {
            log.error("Failed to sync milestone weights with topic assessments in H2", e);
        }
    }

    // =========================================================================
    // 3. CLASS ACTIVITIES & AUDIT LOGS (H2 DATABASE)
    // =========================================================================

    @Transactional
    public List<ClassActivityEntity> getActivities(Long classId) {
        List<ClassActivityEntity> list = activityRepository.findByTrainingClass_IdOrderByIdDesc(classId);
        if (list.isEmpty()) {
            list = initializeActivitiesFromH2(classId);
        }
        return list;
    }

    @Transactional
    public ClassActivityEntity addActivity(Long classId, Map<String, Object> body) {
        String author = body.get("author") != null ? String.valueOf(body.get("author")) : resolveDefaultActor(classId);
        String content = body.get("content") != null ? String.valueOf(body.get("content")) : "";
        String type = body.get("type") != null ? String.valueOf(body.get("type")) : "comment";
        String initials = buildInitials(author);
        String now = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        TrainingClass tc = getTrainingClassOrFallback(classId);

        ClassActivityEntity entity = ClassActivityEntity.builder()
                .trainingClass(tc)
                .author(author)
                .initials(initials)
                .content(content)
                .timestamp(now)
                .type(type)
                .build();

        return activityRepository.save(entity);
    }

    // =========================================================================
    // 4. CLASS ATTENDANCE TRACKER (H2 DATABASE)
    // =========================================================================

    private static final int DEFAULT_CONDUCTED_SESSIONS = 20;
    private static final int DEFAULT_PLANNED_SESSIONS = 40;
    private static final int[][] PRESET_ATTENDANCE_PROFILES = {
            {0, 0, 0}, {1, 0, 1}, {1, 2, 1}, {0, 0, 0}, {1, 1, 2},
            {1, 3, 1}, {1, 0, 0}, {1, 2, 2}, {1, 4, 1}, {0, 0, 1}
    };
    private static final List<String> ATTENDANCE_SESSION_TOPICS = List.of(
            "Session 01: Course Orientation & Java Environment Setup",
            "Session 02: Java Syntax, Data Types & Control Flow",
            "Session 03: Object-Oriented Programming - Classes & Objects",
            "Session 04: Inheritance, Polymorphism & Abstraction",
            "Session 05: Interfaces, Packages & Access Modifiers",
            "Session 06: Exception Handling & Debugging in Java",
            "Session 07: Java Collections Framework - List & Set",
            "Session 08: Java Collections Framework - Map & Generics",
            "Session 09: Java Streams API & Lambda Expressions",
            "Session 10: File I/O & Serialization",
            "Session 11: Multithreading & Concurrency Basics",
            "Session 12: JDBC & Relational Database Connectivity",
            "Session 13: Maven Build Tool & Unit Testing with JUnit 5",
            "Session 14: Spring Core & Dependency Injection",
            "Session 15: Spring Boot Auto-Configuration & Profiles",
            "Session 16: Building RESTful APIs with Spring Web MVC",
            "Session 17: Spring Data JPA & Hibernate ORM",
            "Session 18: Bean Validation & Global Exception Handling",
            "Session 19: Spring Security & JWT Authentication",
            "Session 20: Midterm Project Review & Code Assessment"
    );

    private record AttendanceSeedTrainee(Long traineeId, String studentId, String fullName, String personalEmail) {}

    @Transactional
    public Map<String, Object> getClassAttendance(Long classId) {
        List<ClassAttendanceEntity> list = attendanceRepository.findByClassIdOrderByTraineeIdAsc(classId);
        if (list.isEmpty()) {
            list = initializeAttendanceFromH2(classId);
        }

        int conductedSessions = list.stream()
                .map(ClassAttendanceEntity::getConductedSessions)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(DEFAULT_CONDUCTED_SESSIONS);
        int plannedSessions = list.stream()
                .map(ClassAttendanceEntity::getPlannedSessions)
                .filter(Objects::nonNull)
                .max(Integer::compareTo)
                .orElse(DEFAULT_PLANNED_SESSIONS);

        List<Map<String, Object>> records = new ArrayList<>();
        Map<String, Map<String, Object>> recordsByTraineeId = new LinkedHashMap<>();
        for (ClassAttendanceEntity entity : list) {
            List<Map<String, Object>> logs = parseAttendanceLogs(entity.getLogsJson());
            Map<String, Object> traineeRecord = new LinkedHashMap<>();
            traineeRecord.put("traineeId", entity.getTraineeId());
            traineeRecord.put("excusedAbsent", entity.getExcusedAbsent() != null ? entity.getExcusedAbsent() : 0);
            traineeRecord.put("unexcusedAbsent", entity.getUnexcusedAbsent() != null ? entity.getUnexcusedAbsent() : 0);
            traineeRecord.put("lateCount", entity.getLateCount() != null ? entity.getLateCount() : 0);
            traineeRecord.put("logs", logs);
            recordsByTraineeId.put(String.valueOf(entity.getTraineeId()), traineeRecord);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", entity.getId());
            row.put("classId", entity.getClassId());
            row.put("traineeId", entity.getTraineeId());
            row.put("studentId", entity.getStudentId());
            row.put("fullName", entity.getFullName());
            row.put("personalEmail", entity.getPersonalEmail());
            row.put("conductedSessions", entity.getConductedSessions());
            row.put("plannedSessions", entity.getPlannedSessions());
            row.put("attendedSessions", entity.getAttendedSessions());
            row.put("excusedAbsent", entity.getExcusedAbsent());
            row.put("unexcusedAbsent", entity.getUnexcusedAbsent());
            row.put("lateCount", entity.getLateCount());
            row.put("absentRate", entity.getAbsentRate());
            row.put("attendanceStatus", entity.getAttendanceStatus());
            row.put("logs", logs);
            row.put("updatedAt", entity.getUpdatedAt());
            records.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("classId", classId);
        result.put("conductedSessions", conductedSessions);
        result.put("plannedSessions", plannedSessions);
        result.put("records", records);
        result.put("recordsByTraineeId", recordsByTraineeId);
        return result;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> saveClassAttendance(Long classId, Map<String, Object> body) {
        int conductedSessions = parseIntOrDefault(body != null ? body.get("conductedSessions") : null, DEFAULT_CONDUCTED_SESSIONS);
        int plannedSessions = Math.max(conductedSessions, parseIntOrDefault(body != null ? body.get("plannedSessions") : null, DEFAULT_PLANNED_SESSIONS));

        Map<Long, Map<String, Object>> traineeMetaById = new HashMap<>();
        if (body != null && body.get("trainees") instanceof List<?> traineeList) {
            for (Object item : traineeList) {
                if (item instanceof Map<?, ?> m) {
                    Long id = parseLongOrNull(m.get("id"));
                    if (id != null) {
                        traineeMetaById.put(id, (Map<String, Object>) m);
                    }
                }
            }
        }

        Object rawRecordsMap = body != null ? body.get("recordsByTraineeId") : null;
        if (!(rawRecordsMap instanceof Map<?, ?> recordsMap)) {
            return getClassAttendance(classId);
        }

        Map<Long, ClassAttendanceEntity> existingByTraineeId = new HashMap<>();
        for (ClassAttendanceEntity existing : attendanceRepository.findByClassIdOrderByTraineeIdAsc(classId)) {
            existingByTraineeId.put(existing.getTraineeId(), existing);
        }

        String nowTs = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        List<ClassAttendanceEntity> toSave = new ArrayList<>();

        for (Map.Entry<?, ?> entry : recordsMap.entrySet()) {
            Long traineeId = parseLongOrNull(entry.getKey());
            if (traineeId == null || !(entry.getValue() instanceof Map<?, ?> recordMap)) {
                continue;
            }

            List<Map<String, Object>> logs = recordMap.get("logs") instanceof List<?> rawLogs
                    ? (List<Map<String, Object>>) (List<?>) rawLogs
                    : List.of();

            int excused = countLogStatus(logs, "Excused", parseIntOrDefault(recordMap.get("excusedAbsent"), 0));
            int unexcused = countLogStatus(logs, "Unexcused", parseIntOrDefault(recordMap.get("unexcusedAbsent"), 0));
            int late = countLogStatus(logs, "Late", parseIntOrDefault(recordMap.get("lateCount"), 0));
            int totalAbsent = excused + unexcused;
            int totalConducted = Math.max(1, conductedSessions);
            int attended = Math.max(0, totalConducted - totalAbsent);
            double absentRate = Math.round(((totalAbsent * 100.0) / totalConducted) * 10.0) / 10.0;
            String status = resolveAttendanceStatusLabel(absentRate);

            ClassAttendanceEntity entity = existingByTraineeId.getOrDefault(
                    traineeId,
                    ClassAttendanceEntity.builder().classId(classId).traineeId(traineeId).build()
            );

            Map<String, Object> meta = traineeMetaById.get(traineeId);
            if (meta != null) {
                if (meta.get("studentId") != null) entity.setStudentId(String.valueOf(meta.get("studentId")));
                if (meta.get("fullName") != null) entity.setFullName(String.valueOf(meta.get("fullName")));
                if (meta.get("personalEmail") != null) entity.setPersonalEmail(String.valueOf(meta.get("personalEmail")));
            }

            entity.setConductedSessions(conductedSessions);
            entity.setPlannedSessions(plannedSessions);
            entity.setAttendedSessions(attended);
            entity.setExcusedAbsent(excused);
            entity.setUnexcusedAbsent(unexcused);
            entity.setLateCount(late);
            entity.setAbsentRate(absentRate);
            entity.setAttendanceStatus(status);
            entity.setLogsJson(serializeAttendanceLogs(logs));
            entity.setUpdatedAt(nowTs);
            toSave.add(entity);
        }

        if (!toSave.isEmpty()) {
            attendanceRepository.saveAll(toSave);
        }
        return getClassAttendance(classId);
    }

    @Transactional
    public List<ClassAttendanceEntity> initializeAttendanceFromH2(Long classId) {
        List<ClassAttendanceEntity> existing = attendanceRepository.findByClassIdOrderByTraineeIdAsc(classId);
        if (!existing.isEmpty()) {
            return existing;
        }

        List<AttendanceSeedTrainee> seedTrainees = resolveSeedAttendanceTrainees(classId);
        if (seedTrainees.isEmpty()) {
            return List.of();
        }

        TrainingClass tc = trainingClassRepository.findById(classId).orElse(null);
        LocalDate start = tc != null && tc.getStartDate() != null ? tc.getStartDate() : LocalDate.now().minusDays(45);
        LocalDate today = LocalDate.now();
        LocalDate pastEnd = today.minusDays(1);
        if (tc != null && tc.getEndDate() != null && tc.getEndDate().isBefore(pastEnd)) {
            pastEnd = tc.getEndDate();
        }
        if (start.isAfter(pastEnd)) {
            start = pastEnd.minusDays(30);
        }
        long spanDays = Math.max(1, Duration.between(start.atStartOfDay(), pastEnd.atStartOfDay()).toDays());

        List<String> sessionDates = new ArrayList<>();
        for (int i = 0; i < DEFAULT_CONDUCTED_SESSIONS; i++) {
            long offset = Math.round((i * (double) spanDays) / Math.max(1, DEFAULT_CONDUCTED_SESSIONS - 1));
            sessionDates.add(start.plusDays(offset).toString());
        }

        String nowTs = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        List<ClassAttendanceEntity> entities = new ArrayList<>();
        for (int idx = 0; idx < seedTrainees.size(); idx++) {
            AttendanceSeedTrainee trainee = seedTrainees.get(idx);
            int[] profile = PRESET_ATTENDANCE_PROFILES[idx % PRESET_ATTENDANCE_PROFILES.length];
            List<Map<String, Object>> logs = buildSeedAttendanceLogs(
                    DEFAULT_CONDUCTED_SESSIONS, profile[0], profile[1], profile[2], sessionDates
            );
            int excused = countLogStatus(logs, "Excused", profile[0]);
            int unexcused = countLogStatus(logs, "Unexcused", profile[1]);
            int late = countLogStatus(logs, "Late", profile[2]);
            int totalAbsent = excused + unexcused;
            int attended = Math.max(0, DEFAULT_CONDUCTED_SESSIONS - totalAbsent);
            double absentRate = Math.round(((totalAbsent * 100.0) / DEFAULT_CONDUCTED_SESSIONS) * 10.0) / 10.0;

            entities.add(ClassAttendanceEntity.builder()
                    .classId(classId)
                    .traineeId(trainee.traineeId())
                    .studentId(trainee.studentId())
                    .fullName(trainee.fullName())
                    .personalEmail(trainee.personalEmail())
                    .conductedSessions(DEFAULT_CONDUCTED_SESSIONS)
                    .plannedSessions(DEFAULT_PLANNED_SESSIONS)
                    .attendedSessions(attended)
                    .excusedAbsent(excused)
                    .unexcusedAbsent(unexcused)
                    .lateCount(late)
                    .absentRate(absentRate)
                    .attendanceStatus(resolveAttendanceStatusLabel(absentRate))
                    .logsJson(serializeAttendanceLogs(logs))
                    .updatedAt(nowTs)
                    .build());
        }

        return attendanceRepository.saveAll(entities);
    }

    // =========================================================================
    // 4B. DYNAMIC SCHEMA TOPIC MARKS (DERIVED FROM CLASS_TOPIC_ASSESSMENTS IN H2)
    // =========================================================================

    private static final double TOPIC_MARK_PASS_THRESHOLD = 6.0;
    private static final double[] PRESET_TOPIC_MARK_BASES = {8.4, 5.2, 7.8, 8.9, 7.3, 4.8, 7.9, 6.8, 8.7, 5.2};

    private record DynamicColumnSpec(String key, String name, double weight, int quantity) {}
    private record DynamicTopicSpec(String code, String name, String title, double totalWeight, boolean weightValid, List<DynamicColumnSpec> columns) {}

    @Transactional
    public List<ClassTopicMarkEntity> initializeTopicMarksFromH2(Long classId) {
        List<DynamicTopicSpec> specs = resolveDynamicTopicSpecs(classId);
        List<AttendanceSeedTrainee> trainees = resolveSeedAttendanceTrainees(classId);
        if (specs.isEmpty() || trainees.isEmpty()) {
            return topicMarkRepository.findByClassIdOrderByTopicCodeAscTraineeIdAsc(classId);
        }

        List<ClassTopicMarkEntity> existing = topicMarkRepository.findByClassIdOrderByTopicCodeAscTraineeIdAsc(classId);
        Map<String, ClassTopicMarkEntity> existingMap = new HashMap<>();
        for (ClassTopicMarkEntity entity : existing) {
            existingMap.put(entity.getTopicCode() + ":" + entity.getTraineeId(), entity);
        }

        String nowTs = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        List<ClassTopicMarkEntity> toSave = new ArrayList<>();
        for (int tIdx = 0; tIdx < specs.size(); tIdx++) {
            DynamicTopicSpec spec = specs.get(tIdx);
            for (int rIdx = 0; rIdx < trainees.size(); rIdx++) {
                AttendanceSeedTrainee trainee = trainees.get(rIdx);
                String lookupKey = spec.code() + ":" + trainee.traineeId();
                if (existingMap.containsKey(lookupKey)) {
                    continue;
                }

                Map<String, Double> initialScores = buildInitialDynamicScores(rIdx, tIdx, spec.columns());
                double gpa = calculateWeightedTopicGpa(initialScores, spec.columns());
                toSave.add(ClassTopicMarkEntity.builder()
                        .classId(classId)
                        .topicCode(spec.code())
                        .topicTitle(spec.title())
                        .traineeId(trainee.traineeId())
                        .studentId(trainee.studentId())
                        .fullName(trainee.fullName())
                        .personalEmail(trainee.personalEmail())
                        .scoresJson(serializeScoresJson(initialScores))
                        .totalGpa(gpa)
                        .passed(gpa >= TOPIC_MARK_PASS_THRESHOLD)
                        .updatedAt(nowTs)
                        .build());
            }
        }

        if (!toSave.isEmpty()) {
            topicMarkRepository.saveAll(toSave);
        }
        return topicMarkRepository.findByClassIdOrderByTopicCodeAscTraineeIdAsc(classId);
    }

    @Transactional
    public Map<String, Object> getClassTopicMarks(Long classId) {
        List<DynamicTopicSpec> specs = resolveDynamicTopicSpecs(classId);
        List<ClassTopicMarkEntity> allMarks = initializeTopicMarksFromH2(classId);

        Map<String, List<ClassTopicMarkEntity>> marksByTopic = new HashMap<>();
        for (ClassTopicMarkEntity entity : allMarks) {
            marksByTopic.computeIfAbsent(entity.getTopicCode(), k -> new ArrayList<>()).add(entity);
        }

        Map<String, ClassTopicMarkLockEntity> locksByTopic = new HashMap<>();
        for (ClassTopicMarkLockEntity lockEntity : topicMarkLockRepository.findByClassId(classId)) {
            locksByTopic.put(lockEntity.getTopicCode(), lockEntity);
        }
        Instant now = Instant.now(trainingClassClock);

        List<Map<String, Object>> topicPayloads = new ArrayList<>();
        for (DynamicTopicSpec spec : specs) {
            List<Map<String, Object>> columnPayloads = new ArrayList<>();
            for (DynamicColumnSpec col : spec.columns()) {
                Map<String, Object> colMap = new LinkedHashMap<>();
                colMap.put("key", col.key());
                colMap.put("name", col.name());
                colMap.put("weight", col.weight());
                colMap.put("quantity", col.quantity());
                columnPayloads.add(colMap);
            }

            Map<String, Map<String, Object>> recordsByTraineeId = new LinkedHashMap<>();
            List<ClassTopicMarkEntity> topicEntities = marksByTopic.getOrDefault(spec.code(), List.of());
            for (ClassTopicMarkEntity entity : topicEntities) {
                Map<String, Double> parsedScores = parseScoresJson(entity.getScoresJson());
                Map<String, Double> alignedScores = new LinkedHashMap<>();
                for (DynamicColumnSpec col : spec.columns()) {
                    alignedScores.put(col.key(), resolveAlignedScore(parsedScores, col.key()));
                }
                double gpa = calculateWeightedTopicGpa(alignedScores, spec.columns());

                Map<String, Object> rec = new LinkedHashMap<>();
                rec.put("traineeId", entity.getTraineeId());
                rec.put("studentId", entity.getStudentId());
                rec.put("fullName", entity.getFullName());
                rec.put("personalEmail", entity.getPersonalEmail());
                rec.put("componentScores", alignedScores);
                rec.put("totalGpa", gpa);
                rec.put("passed", gpa >= TOPIC_MARK_PASS_THRESHOLD);
                rec.put("updatedAt", entity.getUpdatedAt());
                recordsByTraineeId.put(String.valueOf(entity.getTraineeId()), rec);
            }

            Map<String, Object> topicMap = new LinkedHashMap<>();
            topicMap.put("code", spec.code());
            topicMap.put("name", spec.name());
            topicMap.put("title", spec.title());
            topicMap.put("totalWeight", spec.totalWeight());
            topicMap.put("weightValid", spec.weightValid());
            topicMap.put("columns", columnPayloads);
            topicMap.put("recordsByTraineeId", recordsByTraineeId);
            topicMap.put("lock", toLockStatusMap(locksByTopic.get(spec.code()), now));
            topicPayloads.add(topicMap);
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("classId", classId);
        response.put("passThreshold", TOPIC_MARK_PASS_THRESHOLD);
        response.put("topics", topicPayloads);
        return response;
    }

    @Transactional
    @SuppressWarnings("unchecked")
    public Map<String, Object> saveClassTopicMarks(Long classId, Map<String, Object> body) {
        if (body == null || body.get("topicCode") == null) {
            throw new BadRequestException("topicCode is required.");
        }
        String topicCode = String.valueOf(body.get("topicCode")).trim();
        if (topicCode.isBlank()) {
            throw new BadRequestException("topicCode is required.");
        }

        List<DynamicTopicSpec> specs = resolveDynamicTopicSpecs(classId);
        DynamicTopicSpec targetSpec = specs.stream()
                .filter(s -> s.code().equals(topicCode))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Unknown topicCode for class " + classId + ": " + topicCode));

        topicMarkLockRepository.findByClassIdAndTopicCode(classId, topicCode)
                .filter(l -> Boolean.TRUE.equals(l.getLocked()))
                .ifPresent(l -> {
                    throw new ConflictException("Topic Marks for [" + topicCode + "] are locked. Enter the 4-digit security PIN to unlock before modifying scores.");
                });

        Object rawRecordsMap = body.get("recordsByTraineeId");
        if (!(rawRecordsMap instanceof Map<?, ?> recordsMap)) {
            throw new BadRequestException("recordsByTraineeId object is required.");
        }

        Map<Long, Map<String, Object>> traineeMetaById = new HashMap<>();
        if (body.get("trainees") instanceof List<?> traineeList) {
            for (Object item : traineeList) {
                if (item instanceof Map<?, ?> m) {
                    Long id = parseLongOrNull(m.get("id"));
                    if (id != null) {
                        traineeMetaById.put(id, (Map<String, Object>) m);
                    }
                }
            }
        }

        Map<Long, ClassTopicMarkEntity> existingByTraineeId = new HashMap<>();
        for (ClassTopicMarkEntity existing : topicMarkRepository.findByClassIdAndTopicCodeOrderByTraineeIdAsc(classId, topicCode)) {
            existingByTraineeId.put(existing.getTraineeId(), existing);
        }

        String nowTs = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        List<ClassTopicMarkEntity> toSave = new ArrayList<>();

        for (Map.Entry<?, ?> entry : recordsMap.entrySet()) {
            Long traineeId = parseLongOrNull(entry.getKey());
            if (traineeId == null || !(entry.getValue() instanceof Map<?, ?> recordMap)) {
                continue;
            }
            Object rawScoresObj = recordMap.get("componentScores");
            if (!(rawScoresObj instanceof Map<?, ?> rawScoresMap)) {
                throw new BadRequestException("componentScores map is required for trainee " + traineeId + ".");
            }

            Map<String, Double> cleanScores = new LinkedHashMap<>();
            for (DynamicColumnSpec col : targetSpec.columns()) {
                Object rawVal = rawScoresMap.get(col.key());
                if (rawVal == null || String.valueOf(rawVal).trim().isEmpty()) {
                    throw new BadRequestException("Score for '" + col.name() + "' cannot be empty.");
                }
                double parsed;
                try {
                    parsed = Double.parseDouble(String.valueOf(rawVal).trim());
                } catch (NumberFormatException ex) {
                    throw new BadRequestException("Score for '" + col.name() + "' must be a valid number.");
                }
                if (!Double.isFinite(parsed) || parsed < 0.0 || parsed > 10.0) {
                    throw new BadRequestException("Score for '" + col.name() + "' must be between 0 and 10.");
                }
                cleanScores.put(col.key(), Math.round(parsed * 10.0) / 10.0);
            }

            double gpa = calculateWeightedTopicGpa(cleanScores, targetSpec.columns());
            ClassTopicMarkEntity entity = existingByTraineeId.getOrDefault(
                    traineeId,
                    ClassTopicMarkEntity.builder()
                            .classId(classId)
                            .topicCode(topicCode)
                            .traineeId(traineeId)
                            .build()
            );

            entity.setTopicTitle(targetSpec.title());
            Map<String, Object> meta = traineeMetaById.get(traineeId);
            if (meta != null) {
                if (meta.get("studentId") != null) entity.setStudentId(String.valueOf(meta.get("studentId")));
                if (meta.get("fullName") != null) entity.setFullName(String.valueOf(meta.get("fullName")));
                if (meta.get("personalEmail") != null) entity.setPersonalEmail(String.valueOf(meta.get("personalEmail")));
            }
            entity.setScoresJson(serializeScoresJson(cleanScores));
            entity.setTotalGpa(gpa);
            entity.setPassed(gpa >= TOPIC_MARK_PASS_THRESHOLD);
            entity.setUpdatedAt(nowTs);
            toSave.add(entity);
        }

        if (!toSave.isEmpty()) {
            topicMarkRepository.saveAll(toSave);
            String actor = resolveDefaultActor(classId);
            String sourceRaw = body.get("source") != null ? String.valueOf(body.get("source")) : "inline_edit";
            String sourceLabel = "excel_import".equalsIgnoreCase(sourceRaw) ? "Excel Import" : "Inline Edit";
            activityRepository.save(ClassActivityEntity.builder()
                    .trainingClass(getTrainingClassOrFallback(classId))
                    .author(actor)
                    .initials(buildInitials(actor))
                    .content("saved Topic Marks for [" + topicCode + "] (" + toSave.size() + " trainees, source: " + sourceLabel + ").")
                    .timestamp(nowTs)
                    .type("history")
                    .build());
        }

        return getClassTopicMarks(classId);
    }

    // =========================================================================
    // 4C. TOPIC MARK SECURITY PIN LOCK & PROGRESSIVE COOLDOWN (H2 DATABASE)
    // =========================================================================

    private static final int MAX_PIN_ATTEMPTS = 3;
    private static final int[] LOCKOUT_TIER_MINUTES = {1, 5, 15, 30};
    private static final SecureRandom PIN_RANDOM = new SecureRandom();

    @Transactional
    public Map<String, Object> lockClassTopicMarks(Long classId, Map<String, Object> body) {
        String topicCode = body != null && body.get("topicCode") != null
                ? String.valueOf(body.get("topicCode")).trim()
                : "";
        if (topicCode.isBlank()) {
            throw new BadRequestException("topicCode is required.");
        }

        List<DynamicTopicSpec> specs = resolveDynamicTopicSpecs(classId);
        boolean validTopic = specs.stream().anyMatch(s -> s.code().equals(topicCode));
        if (!validTopic) {
            throw new BadRequestException("Unknown topicCode for class " + classId + ": " + topicCode);
        }

        ClassTopicMarkLockEntity entity = topicMarkLockRepository.findByClassIdAndTopicCode(classId, topicCode)
                .orElseGet(() -> ClassTopicMarkLockEntity.builder()
                        .classId(classId)
                        .topicCode(topicCode)
                        .locked(false)
                        .failedAttempts(0)
                        .lockoutTier(0)
                        .build());

        if (Boolean.TRUE.equals(entity.getLocked())) {
            throw new ConflictException("Topic Marks for [" + topicCode + "] are already locked.");
        }

        String pin = String.format("%04d", PIN_RANDOM.nextInt(10_000));
        Instant now = Instant.now(trainingClassClock);
        String nowTs = LocalDateTime.now(trainingClassClock).format(ACTIVITY_TS_FMT);
        String actor = resolveCurrentActor(classId);

        entity.setLocked(true);
        entity.setPinHash(passwordEncoder.encode(pin));
        entity.setFailedAttempts(0);
        entity.setLockoutTier(0);
        entity.setCooldownUntil(null);
        entity.setLockedBy(actor);
        entity.setLockedAt(nowTs);
        topicMarkLockRepository.save(entity);

        activityRepository.save(ClassActivityEntity.builder()
                .trainingClass(getTrainingClassOrFallback(classId))
                .author(actor)
                .initials(buildInitials(actor))
                .content("locked Topic Marks for [" + topicCode + "] with a 4-digit security PIN.")
                .timestamp(nowTs)
                .type("history")
                .build());

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("locked", true);
        res.put("topicCode", topicCode);
        res.put("pin", pin);
        res.put("lock", toLockStatusMap(entity, now));
        res.put("gradebook", getClassTopicMarks(classId));
        return res;
    }

    @Transactional
    public Map<String, Object> unlockClassTopicMarks(Long classId, Map<String, Object> body) {
        String topicCode = body != null && body.get("topicCode") != null
                ? String.valueOf(body.get("topicCode")).trim()
                : "";
        if (topicCode.isBlank()) {
            throw new BadRequestException("topicCode is required.");
        }
        String pin = body.get("pin") != null ? String.valueOf(body.get("pin")).trim() : "";
        if (!pin.matches("^\\d{4}$")) {
            throw new BadRequestException("Please enter a valid 4-digit numeric PIN.");
        }

        Instant now = Instant.now(trainingClassClock);
        Optional<ClassTopicMarkLockEntity> optEntity = topicMarkLockRepository.findByClassIdAndTopicCode(classId, topicCode);
        if (optEntity.isEmpty() || !Boolean.TRUE.equals(optEntity.get().getLocked())) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("unlocked", true);
            res.put("httpStatus", 200);
            res.put("topicCode", topicCode);
            res.put("message", "Topic Marks are already unlocked.");
            res.put("lock", toLockStatusMap(optEntity.orElse(null), now));
            res.put("gradebook", getClassTopicMarks(classId));
            return res;
        }

        ClassTopicMarkLockEntity entity = optEntity.get();
        if (entity.getCooldownUntil() != null && now.isBefore(entity.getCooldownUntil())) {
            Map<String, Object> res = new LinkedHashMap<>();
            res.put("unlocked", false);
            res.put("httpStatus", 429);
            res.put("cooldownActive", true);
            res.put("topicCode", topicCode);
            res.put("message", "Too many failed attempts. Unlocking is temporarily locked.");
            res.put("lock", toLockStatusMap(entity, now));
            return res;
        }

        String actor = resolveCurrentActor(classId);
        String nowTs = LocalDateTime.now(trainingClassClock).format(ACTIVITY_TS_FMT);

        if (entity.getPinHash() != null && passwordEncoder.matches(pin, entity.getPinHash())) {
            entity.setLocked(false);
            entity.setPinHash(null);
            entity.setFailedAttempts(0);
            entity.setLockoutTier(0);
            entity.setCooldownUntil(null);
            entity.setUnlockedAt(nowTs);
            topicMarkLockRepository.save(entity);

            activityRepository.save(ClassActivityEntity.builder()
                    .trainingClass(getTrainingClassOrFallback(classId))
                    .author(actor)
                    .initials(buildInitials(actor))
                    .content("unlocked Topic Marks for [" + topicCode + "] using 4-digit security PIN.")
                    .timestamp(nowTs)
                    .type("history")
                    .build());

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("unlocked", true);
            res.put("httpStatus", 200);
            res.put("topicCode", topicCode);
            res.put("message", "Unlocked Topic Marks for " + topicCode + ".");
            res.put("lock", toLockStatusMap(entity, now));
            res.put("gradebook", getClassTopicMarks(classId));
            return res;
        }

        // Wrong PIN attempt -> commit failedAttempts / progressive lockout cleanly without exception rollback
        if (entity.getCooldownUntil() != null) {
            entity.setCooldownUntil(null);
        }
        int attempts = (entity.getFailedAttempts() != null ? entity.getFailedAttempts() : 0) + 1;
        if (attempts >= MAX_PIN_ATTEMPTS) {
            int nextTier = (entity.getLockoutTier() != null ? entity.getLockoutTier() : 0) + 1;
            int penaltyMinutes = LOCKOUT_TIER_MINUTES[Math.min(nextTier - 1, LOCKOUT_TIER_MINUTES.length - 1)];
            Instant until = now.plus(Duration.ofMinutes(penaltyMinutes));

            entity.setFailedAttempts(0);
            entity.setLockoutTier(nextTier);
            entity.setCooldownUntil(until);
            topicMarkLockRepository.save(entity);

            activityRepository.save(ClassActivityEntity.builder()
                    .trainingClass(getTrainingClassOrFallback(classId))
                    .author(actor)
                    .initials(buildInitials(actor))
                    .content("SECURITY ALERT: 3 failed PIN attempts on Topic Marks [" + topicCode + "] — locked out for " + penaltyMinutes + " minute(s) (Tier " + nextTier + ").")
                    .timestamp(nowTs)
                    .type("history")
                    .build());

            Map<String, Object> res = new LinkedHashMap<>();
            res.put("unlocked", false);
            res.put("httpStatus", 429);
            res.put("cooldownActive", true);
            res.put("penaltyMinutes", penaltyMinutes);
            res.put("topicCode", topicCode);
            res.put("message", "Incorrect PIN entered 3 times. Locked for " + penaltyMinutes + " minute(s).");
            res.put("lock", toLockStatusMap(entity, now));
            return res;
        }

        int remaining = MAX_PIN_ATTEMPTS - attempts;
        entity.setFailedAttempts(attempts);
        topicMarkLockRepository.save(entity);

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("unlocked", false);
        res.put("httpStatus", 400);
        res.put("cooldownActive", false);
        res.put("topicCode", topicCode);
        res.put("message", "Incorrect 4-digit PIN. " + remaining + " attempt(s) remaining before temporary lockout.");
        res.put("lock", toLockStatusMap(entity, now));
        return res;
    }

    private Map<String, Object> toLockStatusMap(ClassTopicMarkLockEntity lockEntity, Instant now) {
        Map<String, Object> status = new LinkedHashMap<>();
        boolean isLocked = lockEntity != null && Boolean.TRUE.equals(lockEntity.getLocked());
        Instant cooldownUntil = lockEntity != null ? lockEntity.getCooldownUntil() : null;
        boolean cooldownActive = cooldownUntil != null && now.isBefore(cooldownUntil);
        long cooldownSeconds = cooldownActive
                ? Math.max(1L, (Duration.between(now, cooldownUntil).toMillis() + 999L) / 1000L)
                : 0L;
        int rawFailed = lockEntity != null && lockEntity.getFailedAttempts() != null ? lockEntity.getFailedAttempts() : 0;
        int effectiveFailed = (cooldownUntil != null && !cooldownActive) ? 0 : rawFailed;
        int remainingAttempts = cooldownActive ? 0 : Math.max(0, MAX_PIN_ATTEMPTS - effectiveFailed);
        int tier = lockEntity != null && lockEntity.getLockoutTier() != null ? lockEntity.getLockoutTier() : 0;

        status.put("locked", isLocked);
        status.put("lockedBy", lockEntity != null && lockEntity.getLockedBy() != null ? lockEntity.getLockedBy() : "");
        status.put("lockedAt", lockEntity != null && lockEntity.getLockedAt() != null ? lockEntity.getLockedAt() : "");
        status.put("failedAttempts", effectiveFailed);
        status.put("remainingAttempts", remainingAttempts);
        status.put("maxAttempts", MAX_PIN_ATTEMPTS);
        status.put("lockoutTier", tier);
        status.put("cooldownUntilEpochMs", cooldownActive ? cooldownUntil.toEpochMilli() : null);
        status.put("cooldownSecondsRemaining", cooldownSeconds);
        return status;
    }

    private String resolveCurrentActor(Long classId) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.isAuthenticated() && auth.getName() != null
                && !auth.getName().isBlank() && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        return resolveDefaultActor(classId);
    }

    @Transactional
    public void recalculateTopicMarksForUpdatedSchema(Long classId) {
        List<DynamicTopicSpec> specs = resolveDynamicTopicSpecs(classId);
        List<ClassTopicMarkEntity> existingMarks = topicMarkRepository.findByClassIdOrderByTopicCodeAscTraineeIdAsc(classId);
        if (existingMarks.isEmpty() || specs.isEmpty()) {
            return;
        }

        Map<String, DynamicTopicSpec> specByCode = new HashMap<>();
        for (DynamicTopicSpec spec : specs) {
            specByCode.put(spec.code(), spec);
        }

        String nowTs = LocalDateTime.now().format(ACTIVITY_TS_FMT);
        List<ClassTopicMarkEntity> updated = new ArrayList<>();
        for (ClassTopicMarkEntity mark : existingMarks) {
            DynamicTopicSpec spec = specByCode.get(mark.getTopicCode());
            if (spec == null) continue;

            Map<String, Double> existingScores = parseScoresJson(mark.getScoresJson());
            Map<String, Double> alignedScores = new LinkedHashMap<>();
            for (DynamicColumnSpec col : spec.columns()) {
                alignedScores.put(col.key(), resolveAlignedScore(existingScores, col.key()));
            }
            double gpa = calculateWeightedTopicGpa(alignedScores, spec.columns());
            mark.setTopicTitle(spec.title());
            mark.setScoresJson(serializeScoresJson(alignedScores));
            mark.setTotalGpa(gpa);
            mark.setPassed(gpa >= TOPIC_MARK_PASS_THRESHOLD);
            mark.setUpdatedAt(nowTs);
            updated.add(mark);
        }

        if (!updated.isEmpty()) {
            topicMarkRepository.saveAll(updated);
        }
    }

    private double resolveAlignedScore(Map<String, Double> existingScores, String colKey) {
        if (existingScores.containsKey(colKey)) {
            return existingScores.get(colKey);
        }
        int qIdx = colKey.indexOf("_q");
        if (qIdx > 0) {
            String baseKey = colKey.substring(0, qIdx);
            if (existingScores.containsKey(baseKey)) {
                return existingScores.get(baseKey);
            }
            double sum = 0.0;
            int count = 0;
            String prefix = baseKey + "_q";
            for (Map.Entry<String, Double> e : existingScores.entrySet()) {
                if (e.getKey().startsWith(prefix)) {
                    sum += e.getValue();
                    count++;
                }
            }
            if (count > 0) {
                return Math.round((sum / count) * 10.0) / 10.0;
            }
            return 0.0;
        }
        String prefix = colKey + "_q";
        double sum = 0.0;
        int count = 0;
        for (Map.Entry<String, Double> e : existingScores.entrySet()) {
            if (e.getKey().startsWith(prefix)) {
                sum += e.getValue();
                count++;
            }
        }
        if (count > 0) {
            return Math.round((sum / count) * 10.0) / 10.0;
        }
        return 0.0;
    }

    @SuppressWarnings("unchecked")
    private List<DynamicTopicSpec> resolveDynamicTopicSpecs(Long classId) {
        List<ClassTopicAssessmentEntity> entities = topicAssessmentRepository.findByTrainingClass_IdOrderByTopicIndexAsc(classId);
        if (entities.isEmpty()) {
            entities = initializeTopicAssessmentsFromH2(classId);
        }

        List<DynamicTopicSpec> result = new ArrayList<>();
        Set<String> usedCodes = new HashSet<>();
        int fallbackIdx = 1;

        for (ClassTopicAssessmentEntity entity : entities) {
            String title = entity.getTitle() != null ? entity.getTitle().trim() : "Topic " + fallbackIdx;
            String baseCode = extractTopicCode(title);
            if (baseCode.isBlank()) {
                baseCode = "TOPIC_" + (entity.getTopicIndex() != null ? entity.getTopicIndex() : fallbackIdx);
            }
            String code = baseCode;
            if (!usedCodes.add(code)) {
                int suffix = entity.getTopicIndex() != null ? entity.getTopicIndex() : fallbackIdx;
                while (!usedCodes.add(baseCode + "_" + suffix)) {
                    suffix++;
                }
                code = baseCode + "_" + suffix;
            }
            String cleanName = extractCleanTopicName(title, code);

            List<DynamicColumnSpec> columns = new ArrayList<>();
            Set<String> usedColKeys = new HashSet<>();
            List<Map<String, Object>> parsedAssessments = List.of();
            if (entity.getAssessmentsJson() != null && !entity.getAssessmentsJson().isBlank()) {
                try {
                    parsedAssessments = objectMapper.readValue(
                            entity.getAssessmentsJson(),
                            new TypeReference<List<Map<String, Object>>>() {}
                    );
                } catch (Exception e) {
                    log.error("Failed to parse assessmentsJson for dynamic schema", e);
                }
            }

            int colIdx = 0;
            for (Map<String, Object> item : parsedAssessments) {
                colIdx++;
                if (item == null || "Delete".equalsIgnoreCase(String.valueOf(item.get("action")))) {
                    continue;
                }
                Object rawId = item.get("id");
                String baseKey = rawId != null && !String.valueOf(rawId).isBlank()
                        ? "assessment_" + String.valueOf(rawId).trim()
                        : "assessment_idx_" + colIdx;
                String key = baseKey;
                int keySuffix = colIdx;
                while (!usedColKeys.add(key)) {
                    key = baseKey + "_" + keySuffix++;
                }
                String name = item.get("name") != null && !String.valueOf(item.get("name")).isBlank()
                        ? String.valueOf(item.get("name")).trim()
                        : "Assessment " + colIdx;
                double weight = parseDoubleOrDefault(item.get("weightedNumber"), 0.0);
                int quantity = Math.max(1, parseIntOrDefault(item.get("quantity"), 1));
                if (quantity <= 1) {
                    columns.add(new DynamicColumnSpec(key, name, weight, 1));
                } else {
                    double perCol = Math.floor((weight / quantity) * 10.0) / 10.0;
                    double assigned = 0.0;
                    for (int q = 1; q <= quantity; q++) {
                        double colWeight = (q == quantity)
                                ? Math.round((weight - assigned) * 10.0) / 10.0
                                : perCol;
                        assigned = Math.round((assigned + colWeight) * 10.0) / 10.0;
                        String qKey = key + "_q" + q;
                        while (!usedColKeys.add(qKey)) {
                            qKey = key + "_q" + q + "_" + (keySuffix++);
                        }
                        columns.add(new DynamicColumnSpec(qKey, name + " " + q, colWeight, quantity));
                    }
                }
            }

            if (columns.isEmpty()) {
                columns.add(new DynamicColumnSpec("assessment_default", "Final Assessment", 100.0, 1));
            }

            double totalWeight = Math.round(columns.stream().mapToDouble(DynamicColumnSpec::weight).sum() * 10.0) / 10.0;
            boolean weightValid = Math.abs(totalWeight - 100.0) < 0.01;
            result.add(new DynamicTopicSpec(code, cleanName, title, totalWeight, weightValid, columns));
            fallbackIdx++;
        }

        return result;
    }

    private Map<String, Double> buildInitialDynamicScores(int traineeIdx, int topicIdx, List<DynamicColumnSpec> columns) {
        double base = PRESET_TOPIC_MARK_BASES[traineeIdx % PRESET_TOPIC_MARK_BASES.length];
        double topicOffset = ((topicIdx % 3) - 1) * 0.2;
        Map<String, Double> scores = new LinkedHashMap<>();
        for (int cIdx = 0; cIdx < columns.size(); cIdx++) {
            double colOffset = ((cIdx % 3) - 1) * 0.3;
            double raw = base + topicOffset + colOffset;
            double clamped = Math.round(Math.max(0.0, Math.min(10.0, raw)) * 10.0) / 10.0;
            scores.put(columns.get(cIdx).key(), clamped);
        }
        return scores;
    }

    private double calculateWeightedTopicGpa(Map<String, Double> scores, List<DynamicColumnSpec> columns) {
        if (columns == null || columns.isEmpty()) {
            return 0.0;
        }
        double weightedSum = 0.0;
        double totalWeight = 0.0;
        double plainSum = 0.0;
        for (DynamicColumnSpec col : columns) {
            double score = scores.getOrDefault(col.key(), 0.0);
            weightedSum += score * col.weight();
            totalWeight += col.weight();
            plainSum += score;
        }
        double raw = totalWeight > 0.0 ? (weightedSum / totalWeight) : (plainSum / columns.size());
        double rounded = Math.round(raw * 10.0) / 10.0;
        return Math.max(0.0, Math.min(10.0, rounded));
    }

    private Map<String, Double> parseScoresJson(String scoresJson) {
        if (scoresJson == null || scoresJson.isBlank()) return new LinkedHashMap<>();
        try {
            Map<String, Double> parsed = objectMapper.readValue(scoresJson, new TypeReference<Map<String, Double>>() {});
            return parsed != null ? new LinkedHashMap<>(parsed) : new LinkedHashMap<>();
        } catch (Exception e) {
            log.error("Failed to parse scoresJson", e);
            return new LinkedHashMap<>();
        }
    }

    private String serializeScoresJson(Map<String, Double> scores) {
        try {
            return objectMapper.writeValueAsString(scores != null ? scores : Map.of());
        } catch (Exception e) {
            log.error("Failed to serialize scoresJson", e);
            return "{}";
        }
    }

    private String extractCleanTopicName(String title, String fallbackCode) {
        if (title == null || title.isBlank()) return fallbackCode;
        String cleaned = title.replaceFirst("^\\d+\\.\\s*", "").trim();
        cleaned = cleaned.replaceFirst("^\\[[^\\]]+]\\s*", "").trim();
        return cleaned.isBlank() ? fallbackCode : cleaned;
    }

    private double parseDoubleOrDefault(Object value, double fallback) {
        if (value == null) return fallback;
        try {
            double parsed = Double.parseDouble(String.valueOf(value).trim());
            return Double.isFinite(parsed) ? parsed : fallback;
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private List<AttendanceSeedTrainee> resolveSeedAttendanceTrainees(Long classId) {
        List<ClassEnrollment> enrolled = enrollmentRepository.findByTrainingClass_IdAndIsActiveTrueOrderByIdAsc(classId);
        if (!enrolled.isEmpty()) {
            return enrolled.stream()
                    .map(e -> new AttendanceSeedTrainee(
                            e.getTraineeId(),
                            e.getStudentId(),
                            e.getFullName(),
                            e.getPersonalEmail()
                    ))
                    .toList();
        }
        return masterTraineeDirectory.load().stream()
                .filter(p -> "Active".equalsIgnoreCase(p.status()))
                .limit(10)
                .map(p -> new AttendanceSeedTrainee(p.id(), p.studentId(), p.fullName(), p.personalEmail()))
                .toList();
    }

    private List<Map<String, Object>> buildSeedAttendanceLogs(
            int totalSessions, int excused, int unexcused, int late, List<String> sessionDates) {
        List<Map<String, Object>> logs = new ArrayList<>();
        int remExcused = excused;
        int remUnexcused = unexcused;
        int remLate = late;

        for (int i = 0; i < totalSessions; i++) {
            String status = "Present";
            String note = "Attended on time";
            if (remUnexcused > 0 && i >= 3 && i % 4 == 3) {
                status = "Unexcused";
                note = "Absent without prior notice (Unexcused)";
                remUnexcused--;
            } else if (remExcused > 0 && i >= 5 && i % 5 == 0) {
                status = "Excused";
                note = "Approved leave request (Excused)";
                remExcused--;
            } else if (remLate > 0 && i >= 2 && i % 6 == 2) {
                status = "Late";
                note = "Arrived 15 minutes late";
                remLate--;
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("sessionNumber", i + 1);
            item.put("date", sessionDates.get(i));
            item.put("topic", i < ATTENDANCE_SESSION_TOPICS.size()
                    ? ATTENDANCE_SESSION_TOPICS.get(i)
                    : String.format("Session %02d: Training Session", i + 1));
            item.put("status", status);
            item.put("note", note);
            logs.add(item);
        }

        for (int i = logs.size() - 1; i >= 0 && (remUnexcused > 0 || remExcused > 0 || remLate > 0); i--) {
            if (!"Present".equals(logs.get(i).get("status"))) continue;
            if (remUnexcused > 0) {
                logs.get(i).put("status", "Unexcused");
                logs.get(i).put("note", "Absent without prior notice (Unexcused)");
                remUnexcused--;
            } else if (remExcused > 0) {
                logs.get(i).put("status", "Excused");
                logs.get(i).put("note", "Approved leave request (Excused)");
                remExcused--;
            } else if (remLate > 0) {
                logs.get(i).put("status", "Late");
                logs.get(i).put("note", "Arrived 15 minutes late");
                remLate--;
            }
        }
        return logs;
    }

    private int countLogStatus(List<Map<String, Object>> logs, String targetStatus, int fallback) {
        if (logs == null || logs.isEmpty()) return fallback;
        int count = 0;
        for (Map<String, Object> logItem : logs) {
            if (targetStatus.equals(String.valueOf(logItem.get("status")))) {
                count++;
            }
        }
        return count;
    }

    private String resolveAttendanceStatusLabel(double absentRate) {
        if (absentRate >= 20.0) return "Disqualified";
        if (absentRate >= 10.0) return "At Risk";
        return "Eligible";
    }

    private List<Map<String, Object>> parseAttendanceLogs(String logsJson) {
        if (logsJson == null || logsJson.isBlank()) return List.of();
        try {
            return objectMapper.readValue(logsJson, new TypeReference<List<Map<String, Object>>>() {});
        } catch (Exception e) {
            log.error("Failed to parse logsJson", e);
            return List.of();
        }
    }

    private String serializeAttendanceLogs(List<Map<String, Object>> logs) {
        try {
            return objectMapper.writeValueAsString(logs != null ? logs : List.of());
        } catch (Exception e) {
            log.error("Failed to serialize attendance logs to JSON", e);
            return "[]";
        }
    }

    private int parseIntOrDefault(Object value, int fallback) {
        if (value == null) return fallback;
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private Long parseLongOrNull(Object value) {
        if (value == null) return null;
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    // =========================================================================
    // DYNAMIC H2 INITIALIZATION FROM TRAINING_CLASSES, SESSIONS & SUBJECTS
    // =========================================================================

    private record TopicDescriptor(String code, String displayName, int totalHours, int sessionCount) {}

    private List<TopicDescriptor> resolveTopicsFromH2(Long classId) {
        Map<String, TopicDescriptor> byCode = new LinkedHashMap<>();

        // 1. Check linked ClassTrainingProgram -> ProgramSubject -> Subject in H2
        Optional<ClassTrainingProgram> programLink = classTrainingProgramRepository.findByClassId(classId);
        if (programLink.isPresent() && programLink.get().getProgram() != null) {
            List<ProgramSubject> programSubjects = programLink.get().getProgram().getSubjects();
            if (programSubjects != null) {
                programSubjects.stream()
                        .sorted(Comparator.comparing(ps -> ps.getOrderIndex() != null ? ps.getOrderIndex() : 0))
                        .forEach(ps -> {
                            String code = ps.resolveCode() != null ? ps.resolveCode() : "TOPIC_" + ps.getId();
                            String ver = ps.resolveVersion() != null ? ps.resolveVersion() : "1.0";
                            String name = String.format("[%s] %s (%s)", code, ps.resolveName(), ver);
                            int hours = ps.resolveDurationHours() != null ? ps.resolveDurationHours() : 24;
                            byCode.put(code, new TopicDescriptor(code, name, hours, Math.max(1, hours / 4)));
                        });
            }
        }

        // 2. Inspect actual scheduled Session rows for this class in H2 `sessions` table
        List<Session> classSessions = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .sorted(Comparator.comparing(Session::getStartTime))
                .toList();

        Map<String, Integer> hoursByCode = new LinkedHashMap<>();
        Map<String, Integer> countByCode = new LinkedHashMap<>();
        Map<String, String> labelByCode = new LinkedHashMap<>();

        for (Session s : classSessions) {
            String code = extractTopicCode(s.getTitle());
            if (code.isEmpty()) {
                code = "TOPIC_" + s.getTopicId();
            }
            int sessionHours = 4;
            if (s.getStartTime() != null && s.getEndTime() != null) {
                long h = Duration.between(s.getStartTime(), s.getEndTime()).toHours();
                if (h > 0) sessionHours = (int) h;
            }
            hoursByCode.merge(code, sessionHours, Integer::sum);
            countByCode.merge(code, 1, Integer::sum);
            labelByCode.putIfAbsent(code, formatTopicDisplayNameFromSession(code, s.getTitle()));
        }

        for (Map.Entry<String, Integer> entry : hoursByCode.entrySet()) {
            String code = entry.getKey();
            if (!byCode.containsKey(code)) {
                byCode.put(code, new TopicDescriptor(
                        code,
                        labelByCode.get(code),
                        entry.getValue(),
                        countByCode.getOrDefault(code, 1)
                ));
            }
        }

        // 3. Fall back to active Subject entities only when neither program subjects nor sessions exist
        if (byCode.isEmpty()) {
            for (Subject subj : subjectRepository.findByIsActiveTrueAndStatus(SubjectStatus.ACTIVE)) {
                if (subj.getCode() != null && !byCode.containsKey(subj.getCode())) {
                    int hours = subj.getDurationHours() != null ? subj.getDurationHours() : 24;
                    String display = String.format("[%s] %s (%s)", subj.getCode(), subj.getName(), subj.getVersion() != null ? subj.getVersion() : "1.0");
                    byCode.put(subj.getCode(), new TopicDescriptor(subj.getCode(), display, hours, Math.max(1, hours / 4)));
                }
            }
        }

        return new ArrayList<>(byCode.values());
    }

    @Transactional
    public ClassOperationEntity initializeOperationFromH2(Long classId) {
        Optional<ClassOperationEntity> existing = operationRepository.findByTrainingClass_Id(classId);
        if (existing.isPresent()) {
            return existing.get();
        }

        TrainingClass tc = getTrainingClassOrFallback(classId);
        LocalDate startDate = tc.getStartDate() != null ? tc.getStartDate() : LocalDate.now().withDayOfMonth(1);
        LocalDate endDate = tc.getEndDate() != null ? tc.getEndDate() : startDate.plusMonths(3).withDayOfMonth(28);

        List<Session> classSessions = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && s.getStartTime() != null)
                .sorted(Comparator.comparing(Session::getStartTime))
                .toList();

        List<TopicDescriptor> allTopics = resolveTopicsFromH2(classId);

        // Group sessions by YearMonth from H2 `sessions` table, or distribute across class months
        Map<YearMonth, Map<String, Integer>> monthTopicHours = new LinkedHashMap<>();
        Map<YearMonth, Map<String, LocalDate[]>> monthTopicDates = new LinkedHashMap<>();
        Map<String, LocalDate[]> overallTopicDates = new LinkedHashMap<>();
        Map<String, String> topicDisplayMap = new LinkedHashMap<>();
        for (TopicDescriptor td : allTopics) {
            topicDisplayMap.put(td.code(), td.displayName());
        }

        for (Session s : classSessions) {
            YearMonth ym = YearMonth.from(s.getStartTime());
            String code = extractTopicCode(s.getTitle());
            if (code.isEmpty()) code = "TOPIC_" + s.getTopicId();
            topicDisplayMap.putIfAbsent(code, formatTopicDisplayNameFromSession(code, s.getTitle()));
            int hours = 4;
            if (s.getEndTime() != null) {
                long h = Duration.between(s.getStartTime(), s.getEndTime()).toHours();
                if (h > 0) hours = (int) h;
            }
            monthTopicHours.computeIfAbsent(ym, k -> new LinkedHashMap<>())
                    .merge(code, hours, Integer::sum);

            LocalDate sStart = s.getStartTime().toLocalDate();
            LocalDate sEnd = s.getEndTime() != null ? s.getEndTime().toLocalDate() : sStart;
            updateDateRange(monthTopicDates.computeIfAbsent(ym, k -> new LinkedHashMap<>()), code, sStart, sEnd);
            updateDateRange(overallTopicDates, code, sStart, sEnd);
        }

        // Ensure every month in the TrainingClass's [startDate, endDate] range has a Milestone
        YearMonth startYm = YearMonth.from(startDate);
        YearMonth endYm = YearMonth.from(endDate);
        YearMonth cursor = startYm;
        int topicCursor = 0;
        while (!cursor.isAfter(endYm)) {
            if (!monthTopicHours.containsKey(cursor) && !allTopics.isEmpty()) {
                TopicDescriptor td = allTopics.get(topicCursor % allTopics.size());
                Map<String, Integer> map = new LinkedHashMap<>();
                map.put(td.code(), td.totalHours());
                monthTopicHours.put(cursor, map);
                topicCursor++;
            }
            cursor = cursor.plusMonths(1);
        }

        List<Map<String, Object>> milestones = new ArrayList<>();
        int milestoneId = 1;
        int totalWeighted = 0;

        List<YearMonth> sortedMonths = new ArrayList<>(monthTopicHours.keySet());
        Collections.sort(sortedMonths);

        for (YearMonth ym : sortedMonths) {
            Map<String, Integer> topicsInMonth = monthTopicHours.get(ym);
            if (topicsInMonth == null || topicsInMonth.isEmpty()) continue;

            LocalDate mStart = ym.equals(startYm) ? startDate : ym.atDay(1);
            LocalDate mEnd = ym.equals(endYm) ? endDate : ym.atEndOfMonth();

            List<Map<String, Object>> topicRows = new ArrayList<>();
            int subIdx = 1;
            int totalMonthHours = topicsInMonth.values().stream().mapToInt(Integer::intValue).sum();
            long totalMonthDays = Math.max(1, java.time.temporal.ChronoUnit.DAYS.between(mStart, mEnd) + 1);
            LocalDate fallbackCursor = mStart;
            int processedCount = 0;
            int topicCountInMonth = topicsInMonth.size();
            Map<String, LocalDate[]> ymDateMap = monthTopicDates.getOrDefault(ym, Map.of());

            for (Map.Entry<String, Integer> e : topicsInMonth.entrySet()) {
                String code = e.getKey();
                int hours = e.getValue();
                processedCount++;
                // Weight derived from H2 session hours * planned class size (or standard factor 30)
                int factor = tc != null && tc.getPlannedSize() != null ? tc.getPlannedSize() : 25;
                int weight = hours * factor;
                totalWeighted += weight;

                LocalDate tStart;
                LocalDate tEnd;
                LocalDate[] exactRange = ymDateMap.get(code);
                if (exactRange != null) {
                    tStart = exactRange[0];
                    tEnd = exactRange[1];
                } else {
                    LocalDate[] overallRange = overallTopicDates.get(code);
                    if (overallRange != null && !overallRange[1].isBefore(mStart) && !overallRange[0].isAfter(mEnd)) {
                        tStart = overallRange[0].isBefore(mStart) ? mStart : overallRange[0];
                        tEnd = overallRange[1].isAfter(mEnd) ? mEnd : overallRange[1];
                    } else {
                        tStart = fallbackCursor;
                        if (processedCount == topicCountInMonth) {
                            tEnd = mEnd;
                        } else {
                            long span = totalMonthHours > 0
                                    ? Math.max(1, Math.round((double) hours * totalMonthDays / totalMonthHours))
                                    : Math.max(1, totalMonthDays / Math.max(1, topicCountInMonth));
                            tEnd = tStart.plusDays(span - 1);
                            if (tEnd.isAfter(mEnd)) tEnd = mEnd;
                        }
                        fallbackCursor = tEnd.isBefore(mEnd) ? tEnd.plusDays(1) : mEnd;
                    }
                }

                Map<String, Object> tRow = new LinkedHashMap<>();
                tRow.put("id", milestoneId * 100 + subIdx++);
                tRow.put("topic", topicDisplayMap.getOrDefault(code, "[" + code + "] " + code));
                tRow.put("startDate", tStart.toString());
                tRow.put("endDate", tEnd.toString());
                tRow.put("maxScore", 10);
                tRow.put("passingScore", 6);
                tRow.put("weightedNumber", weight);
                tRow.put("baseWeightedNumber", weight);
                topicRows.add(tRow);
            }

            Map<String, Object> milestone = new LinkedHashMap<>();
            milestone.put("id", milestoneId++);
            milestone.put("name", ym.format(MONTH_LABEL_FMT));
            milestone.put("status", "Baselined");
            milestone.put("checkpointType", "STANDARD");
            milestone.put("salaryPaid", "Yes");
            milestone.put("startDate", mStart.toString());
            milestone.put("endDate", mEnd.toString());
            milestone.put("topics", topicRows);
            milestones.add(milestone);
        }

        String milestonesJson;
        try {
            milestonesJson = objectMapper.writeValueAsString(milestones);
        } catch (Exception e) {
            milestonesJson = "[]";
        }

        ClassOperationEntity entity = ClassOperationEntity.builder()
                .trainingClass(tc)
                .actualStartDate(startDate.toString())
                .earlyGraduatedDate(endDate.toString())
                .actualEndDate("")
                .topicMark(70)
                .disciplinePoint(30)
                .bonusPoint(10)
                .penaltyPoint(20)
                .hasNoAllocationNeeds(false)
                .milestonesJson(milestonesJson)
                .totalWeightedNumber(totalWeighted)
                .build();

        return operationRepository.save(entity);
    }

    @Transactional
    public List<ClassTopicAssessmentEntity> initializeTopicAssessmentsFromH2(Long classId) {
        List<ClassTopicAssessmentEntity> existing = topicAssessmentRepository.findByTrainingClass_IdOrderByTopicIndexAsc(classId);
        if (!existing.isEmpty()) {
            return existing;
        }

        TrainingClass tc = getTrainingClassOrFallback(classId);
        List<TopicDescriptor> topics = resolveTopicsFromH2(classId);
        List<ClassTopicAssessmentEntity> savedList = new ArrayList<>();
        int index = 1;

        for (TopicDescriptor td : topics) {
            String title = index + ". " + td.displayName();
            int labQty = Math.max(1, td.sessionCount() / 2);

            List<Map<String, Object>> assessments = new ArrayList<>();
            Map<String, Object> a1 = new LinkedHashMap<>();
            a1.put("id", index * 100 + 1);
            a1.put("name", "Assignments / Lab Practice");
            a1.put("weightedNumber", 30);
            a1.put("quantity", labQty);
            a1.put("note", "(" + labQty + " lab sessions in H2)");
            a1.put("action", "Keep");
            a1.put("changeStatus", "none");

            Map<String, Object> a2 = new LinkedHashMap<>();
            a2.put("id", index * 100 + 2);
            a2.put("name", "Final Theory Test");
            a2.put("weightedNumber", 30);
            a2.put("quantity", 1);
            a2.put("note", "");
            a2.put("action", "Keep");
            a2.put("changeStatus", "confirmed");

            Map<String, Object> a3 = new LinkedHashMap<>();
            a3.put("id", index * 100 + 3);
            a3.put("name", "Final Practical Assessment");
            a3.put("weightedNumber", 40);
            a3.put("quantity", 1);
            a3.put("note", "");
            a3.put("action", "Keep");
            a3.put("changeStatus", "none");

            assessments.add(a1);
            assessments.add(a2);
            assessments.add(a3);

            String json;
            try {
                json = objectMapper.writeValueAsString(assessments);
            } catch (Exception e) {
                json = "[]";
            }

            ClassTopicAssessmentEntity entity = ClassTopicAssessmentEntity.builder()
                    .trainingClass(tc)
                    .topicIndex(index)
                    .title(title)
                    .assessmentsJson(json)
                    .build();

            savedList.add(topicAssessmentRepository.save(entity));
            index++;
        }

        return savedList;
    }

    @Transactional
    public List<ClassActivityEntity> initializeActivitiesFromH2(Long classId) {
        List<ClassActivityEntity> existing = activityRepository.findByTrainingClass_IdOrderByIdDesc(classId);
        if (!existing.isEmpty()) {
            return existing;
        }

        TrainingClass tc = getTrainingClassOrFallback(classId);
        String classCode = tc.getCode() != null ? tc.getCode() : "CLASS_" + classId;
        String trainer = tc.getMasterTrainer() != null ? tc.getMasterTrainer() : "Trainer";
        String admin = tc.getClassAdmin() != null ? tc.getClassAdmin() : "ClassAdmin";
        String location = tc.getLocation() != null ? tc.getLocation() : "Training Lab";
        long sessionCount = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()))
                .count();

        LocalDateTime baseTime = tc.getStartDate() != null
                ? tc.getStartDate().atTime(9, 0)
                : LocalDateTime.now().minusDays(3);

        List<ClassActivityEntity> list = new ArrayList<>();
        list.add(ClassActivityEntity.builder()
                .trainingClass(tc)
                .author(admin)
                .initials(buildInitials(admin))
                .content("initialized class " + classCode + " at " + location + " in H2 database.")
                .timestamp(baseTime.format(ACTIVITY_TS_FMT))
                .type("history")
                .build());

        list.add(ClassActivityEntity.builder()
                .trainingClass(tc)
                .author(trainer)
                .initials(buildInitials(trainer))
                .content("synchronized " + sessionCount + " training sessions and milestone weights from H2 schedule.")
                .timestamp(baseTime.plusHours(2).format(ACTIVITY_TS_FMT))
                .type("history")
                .build());

        list.add(ClassActivityEntity.builder()
                .trainingClass(tc)
                .author(trainer)
                .initials(buildInitials(trainer))
                .content("Class " + classCode + " curriculum and topic assessments are ready for review.")
                .timestamp(baseTime.plusDays(1).format(ACTIVITY_TS_FMT))
                .type("comment")
                .build());

        List<ClassActivityEntity> saved = activityRepository.saveAll(list);
        Collections.reverse(saved);
        return saved;
    }

    // =========================================================================
    // MAPPING & STRING HELPERS
    // =========================================================================

    private String extractTopicCode(String text) {
        if (text == null || text.isBlank()) return "";
        String cleaned = text.replaceFirst("^\\d+\\.\\s*", "").trim();
        int open = cleaned.indexOf('[');
        int close = cleaned.indexOf(']');
        if (open >= 0 && close > open + 1) {
            return cleaned.substring(open + 1, close).trim();
        }
        int dash = cleaned.indexOf(" - ");
        if (dash > 0) {
            return cleaned.substring(0, dash).trim();
        }
        return cleaned;
    }

    private String formatTopicDisplayNameFromSession(String code, String sessionTitle) {
        return switch (code) {
            case "JAVA_CORE" -> "[JAVA_CORE] Java Core & OOP Fundamentals (1.0)";
            case "SPRING_BOOT" -> "[SPRING_BOOT] Enterprise Backend Development with Spring Boot (1.0)";
            case "DATABASE_SQL" -> "[DATABASE_SQL] Relational Database Design & SQL Optimization (1.0)";
            case "REACT_FRONTEND" -> "[REACT_FRONTEND] Modern Frontend Development with React & TypeScript (1.0)";
            case "DEVOPS_BASIC" -> "[DEVOPS_BASIC] Docker Containerization & CI/CD DevOps Basics (1.0)";
            default -> sessionTitle != null && !sessionTitle.isBlank() ? sessionTitle : "[" + code + "] " + code;
        };
    }

    private String resolveDefaultActor(Long classId) {
        return trainingClassRepository.findById(classId)
                .map(TrainingClass::getClassAdmin)
                .filter(a -> a != null && !a.isBlank())
                .orElse("ClassAdmin");
    }

    private String buildInitials(String author) {
        if (author == null || author.isBlank()) return "CA";
        String cleaned = author.trim();
        String[] parts = cleaned.split("\\s+");
        if (parts.length >= 2) {
            return ("" + parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase(Locale.ROOT);
        }
        return cleaned.length() >= 2 ? cleaned.substring(0, 2).toUpperCase(Locale.ROOT) : cleaned.toUpperCase(Locale.ROOT);
    }

    private Map<String, Object> toOperationMap(ClassOperationEntity entity) {
        Map<String, Object> res = new HashMap<>();
        res.put("classId", entity.getClassId());

        Map<String, Object> opInfo = new HashMap<>();
        opInfo.put("actualStartDate", entity.getActualStartDate() != null ? entity.getActualStartDate() : "");
        opInfo.put("earlyGraduatedDate", entity.getEarlyGraduatedDate() != null ? entity.getEarlyGraduatedDate() : "");
        opInfo.put("actualEndDate", entity.getActualEndDate() != null ? entity.getActualEndDate() : "");
        opInfo.put("hasNoAllocationNeeds", Boolean.TRUE.equals(entity.getHasNoAllocationNeeds()));

        Map<String, Object> gpa = new HashMap<>();
        gpa.put("topicMark", entity.getTopicMark() != null ? entity.getTopicMark() : 70);
        gpa.put("disciplinePoint", entity.getDisciplinePoint() != null ? entity.getDisciplinePoint() : 30);
        gpa.put("bonusPoint", entity.getBonusPoint() != null ? entity.getBonusPoint() : 10);
        gpa.put("penaltyPoint", entity.getPenaltyPoint() != null ? entity.getPenaltyPoint() : 20);
        opInfo.put("gpaCalculation", gpa);

        res.put("operatingInfo", opInfo);

        List<Map<String, Object>> milestones = new ArrayList<>();
        if (entity.getMilestonesJson() != null && !entity.getMilestonesJson().isBlank()) {
            try {
                milestones = objectMapper.readValue(entity.getMilestonesJson(), new TypeReference<List<Map<String, Object>>>() {});
                enrichMilestoneTopicDates(entity.getClassId(), milestones);
            } catch (Exception e) {
                log.error("Failed to parse milestonesJson", e);
            }
        }
        res.put("milestones", milestones);
        res.put("totalWeightedNumber", entity.getTotalWeightedNumber() != null ? entity.getTotalWeightedNumber() : 0);

        return res;
    }

    private void updateDateRange(Map<String, LocalDate[]> target, String code, LocalDate start, LocalDate end) {
        target.compute(code, (k, existing) -> {
            if (existing == null) {
                return new LocalDate[]{start, end};
            }
            LocalDate min = start.isBefore(existing[0]) ? start : existing[0];
            LocalDate max = end.isAfter(existing[1]) ? end : existing[1];
            return new LocalDate[]{min, max};
        });
    }

    @SuppressWarnings("unchecked")
    private void enrichMilestoneTopicDates(Long classId, List<Map<String, Object>> milestones) {
        if (classId == null || milestones == null || milestones.isEmpty()) return;

        Map<YearMonth, Map<String, LocalDate[]>> monthTopicDates = new LinkedHashMap<>();
        Map<String, LocalDate[]> overallTopicDates = new LinkedHashMap<>();

        List<Session> classSessions = sessionRepository.findByClassId(classId).stream()
                .filter(s -> Boolean.TRUE.equals(s.getIsActive()) && s.getStartTime() != null)
                .sorted(Comparator.comparing(Session::getStartTime))
                .toList();

        for (Session s : classSessions) {
            YearMonth ym = YearMonth.from(s.getStartTime());
            String code = extractTopicCode(s.getTitle());
            if (code.isEmpty()) code = "TOPIC_" + s.getTopicId();
            LocalDate sStart = s.getStartTime().toLocalDate();
            LocalDate sEnd = s.getEndTime() != null ? s.getEndTime().toLocalDate() : sStart;
            updateDateRange(monthTopicDates.computeIfAbsent(ym, k -> new LinkedHashMap<>()), code, sStart, sEnd);
            updateDateRange(overallTopicDates, code, sStart, sEnd);
        }

        for (Map<String, Object> m : milestones) {
            List<Map<String, Object>> topics = (List<Map<String, Object>>) m.get("topics");
            if (topics == null || topics.isEmpty()) continue;

            LocalDate mStart = parseLocalDateOrNull(m.get("startDate"));
            LocalDate mEnd = parseLocalDateOrNull(m.get("endDate"));
            YearMonth ym = mStart != null ? YearMonth.from(mStart) : null;
            Map<String, LocalDate[]> ymDates = ym != null ? monthTopicDates.getOrDefault(ym, Map.of()) : Map.of();

            int totalWeight = topics.stream()
                    .mapToInt(t -> Math.max(1, parseIntOrDefault(t.get("weightedNumber"), 1)))
                    .sum();
            long totalDays = (mStart != null && mEnd != null)
                    ? Math.max(1, java.time.temporal.ChronoUnit.DAYS.between(mStart, mEnd) + 1)
                    : 30;
            LocalDate cursor = mStart;

            for (int i = 0; i < topics.size(); i++) {
                Map<String, Object> t = topics.get(i);
                String topicLabel = t.get("topic") != null ? String.valueOf(t.get("topic")) : "";
                String code = extractTopicCode(topicLabel);

                LocalDate[] exactRange = ymDates.get(code);
                if (exactRange != null) {
                    t.put("startDate", exactRange[0].toString());
                    t.put("endDate", exactRange[1].toString());
                    continue;
                }

                Object existingStart = t.get("startDate");
                Object existingEnd = t.get("endDate");
                if (existingStart != null && !String.valueOf(existingStart).isBlank()
                        && existingEnd != null && !String.valueOf(existingEnd).isBlank()) {
                    continue;
                }

                LocalDate[] overallRange = overallTopicDates.get(code);
                if (overallRange != null && mStart != null && mEnd != null
                        && !overallRange[1].isBefore(mStart) && !overallRange[0].isAfter(mEnd)) {
                    LocalDate tStart = overallRange[0].isBefore(mStart) ? mStart : overallRange[0];
                    LocalDate tEnd = overallRange[1].isAfter(mEnd) ? mEnd : overallRange[1];
                    t.put("startDate", tStart.toString());
                    t.put("endDate", tEnd.toString());
                } else if (cursor != null && mEnd != null) {
                    LocalDate tStart = cursor;
                    LocalDate tEnd;
                    if (i == topics.size() - 1) {
                        tEnd = mEnd;
                    } else {
                        int w = Math.max(1, parseIntOrDefault(t.get("weightedNumber"), 1));
                        long span = Math.max(1, Math.round((double) w * totalDays / Math.max(1, totalWeight)));
                        tEnd = tStart.plusDays(span - 1);
                        if (tEnd.isAfter(mEnd)) tEnd = mEnd;
                    }
                    cursor = tEnd.isBefore(mEnd) ? tEnd.plusDays(1) : mEnd;
                    t.put("startDate", tStart.toString());
                    t.put("endDate", tEnd.toString());
                }
            }
        }
    }

    private LocalDate parseLocalDateOrNull(Object value) {
        if (value == null) return null;
        String s = String.valueOf(value).trim();
        if (s.isEmpty()) return null;
        try {
            return LocalDate.parse(s.length() > 10 ? s.substring(0, 10) : s);
        } catch (Exception ignored) {
            return null;
        }
    }

    private Map<String, Object> toTopicMap(ClassTopicAssessmentEntity entity) {
        Map<String, Object> map = new HashMap<>();
        map.put("id", entity.getTopicIndex() != null ? entity.getTopicIndex() : entity.getId());
        map.put("title", entity.getTitle());

        List<Object> assessments = new ArrayList<>();
        if (entity.getAssessmentsJson() != null && !entity.getAssessmentsJson().isBlank()) {
            try {
                assessments = objectMapper.readValue(entity.getAssessmentsJson(), new TypeReference<List<Object>>() {});
            } catch (Exception e) {
                log.error("Failed to parse assessmentsJson", e);
            }
        }
        map.put("assessments", assessments);
        return map;
    }
}
