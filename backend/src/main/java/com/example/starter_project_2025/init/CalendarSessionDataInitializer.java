package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.training.TrainingClassRepository;
import com.example.starter_project_2025.system.training.entity.TrainingClass;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgram;
import com.example.starter_project_2025.system.trainingprogram.ClassTrainingProgramRepository;
import com.example.starter_project_2025.system.trainingprogram.TrainingProgramRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Slf4j
@Order(25)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@StartupMutation
public class CalendarSessionDataInitializer implements CommandLineRunner {

    SessionRepository sessionRepository;
    SubjectRepository subjectRepository;
    TrainingClassRepository trainingClassRepository;
    TrainingProgramRepository trainingProgramRepository;
    ClassTrainingProgramRepository classTrainingProgramRepository;

    @Override
    @Transactional
    public void run(String... args) {
        ensureTrainingClasses();
        purgeOrphanedTestSessionIfNeeded();

        if (sessionRepository.count() > 0) {
            return;
        }

        Long javaCoreId = resolveSubjectId("JAVA_CORE", "1.0");
        Long springBootId = resolveSubjectId("SPRING_BOOT", "1.0");
        Long sqlId = resolveSubjectId("DATABASE_SQL", "1.0");
        Long reactId = resolveSubjectId("REACT_FRONTEND", "1.0");
        Long devopsId = resolveSubjectId("DEVOPS_BASIC", "1.0");

        // =========================================================================
        // 1. CLASS LOCAL_JAVA_01 (Class ID 1) - START DATE: 2026-10-01
        // Matches SRS_Training_Calendar_Management (US-CAL-01, US-CAL-08, US-CAL-09)
        // =========================================================================

        // --- TUẦN 1: 01/10/2026 - 02/10/2026 (US-CAL-08) ---
        // Thứ Năm 01/10/2026
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Java Core & OOP Fundamentals",
                LocalDateTime.of(2026, 10, 1, 8, 0), LocalDateTime.of(2026, 10, 1, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "COMPLETED");
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] OOP Principles & Inheritance Practice",
                LocalDateTime.of(2026, 10, 1, 13, 0), LocalDateTime.of(2026, 10, 1, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "COMPLETED");

        // Thứ Sáu 02/10/2026
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Java Collections Framework & Generics",
                LocalDateTime.of(2026, 10, 2, 8, 0), LocalDateTime.of(2026, 10, 2, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "COMPLETED");
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Hands-on Lab Assignment #1",
                LocalDateTime.of(2026, 10, 2, 13, 0), LocalDateTime.of(2026, 10, 2, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "COMPLETED");

        // --- TUẦN 2: 05/10/2026 - 09/10/2026 (US-CAL-09: Lộ trình chuyển tiếp & nghỉ cuối tuần) ---
        // Thứ Hai 05/10/2026
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Stream API & Functional Programming",
                LocalDateTime.of(2026, 10, 5, 8, 0), LocalDateTime.of(2026, 10, 5, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Concurrency & Multithreading Lab",
                LocalDateTime.of(2026, 10, 5, 13, 0), LocalDateTime.of(2026, 10, 5, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // Thứ Ba 06/10/2026
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Advanced Exception Handling & Custom Exceptions",
                LocalDateTime.of(2026, 10, 6, 8, 0), LocalDateTime.of(2026, 10, 6, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Unit Testing with JUnit 5 & Mockito",
                LocalDateTime.of(2026, 10, 6, 13, 0), LocalDateTime.of(2026, 10, 6, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // Thứ Tư 07/10/2026 (Hoàn tất Java Core)
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Java Core Practical Assessment",
                LocalDateTime.of(2026, 10, 7, 8, 0), LocalDateTime.of(2026, 10, 7, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Code Review & Retrospective",
                LocalDateTime.of(2026, 10, 7, 13, 0), LocalDateTime.of(2026, 10, 7, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // Thứ Năm 08/10/2026 (Tự động chuyển tiếp sang SPRING_BOOT)
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Enterprise Backend Development Overview",
                LocalDateTime.of(2026, 10, 8, 8, 0), LocalDateTime.of(2026, 10, 8, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Boot Architecture & DI/IoC Container",
                LocalDateTime.of(2026, 10, 8, 13, 0), LocalDateTime.of(2026, 10, 8, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // Thứ Sáu 09/10/2026
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Data JPA & MySQL Integration",
                LocalDateTime.of(2026, 10, 9, 8, 0), LocalDateTime.of(2026, 10, 9, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Data Repository & Entity Mapping Lab",
                LocalDateTime.of(2026, 10, 9, 13, 0), LocalDateTime.of(2026, 10, 9, 17, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // --- TUẦN 3: 12/10/2026 - 16/10/2026 (DATABASE_SQL & SPRING_BOOT) ---
        createSession(1L, sqlId, 1L, "[DATABASE_SQL] Relational Database Design & Schema Normalization",
                LocalDateTime.of(2026, 10, 12, 8, 0), LocalDateTime.of(2026, 10, 12, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, sqlId, 1L, "[DATABASE_SQL] Indexing Strategies & Query Optimization",
                LocalDateTime.of(2026, 10, 13, 8, 0), LocalDateTime.of(2026, 10, 13, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, sqlId, 1L, "[DATABASE_SQL] ACID Transactions & Stored Procedures",
                LocalDateTime.of(2026, 10, 14, 8, 0), LocalDateTime.of(2026, 10, 14, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] RESTful API Design & Validation Handling",
                LocalDateTime.of(2026, 10, 15, 8, 0), LocalDateTime.of(2026, 10, 15, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Security & JWT Implementation",
                LocalDateTime.of(2026, 10, 16, 8, 0), LocalDateTime.of(2026, 10, 16, 12, 0),
                "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // =========================================================================
        // 2. SESSIONS CHO TUẦN HIỆN TẠI (09/11/2026 - 15/11/2026)
        // =========================================================================
        LocalDate now = LocalDate.now();
        LocalDate monday = now.minusDays(now.getDayOfWeek().getValue() - 1);

        createSession(1L, javaCoreId, 1L, "[JAVA_CORE] Java Core - Advanced Design Patterns Workshop",
                monday.atTime(8, 0), monday.atTime(12, 0), "Phòng Lab 201 (F-Town 2)", "COMPLETED");
        createSession(1L, sqlId, 1L, "[DATABASE_SQL] Database Indexing & Query Tuning Lab",
                monday.plusDays(1).atTime(8, 0), monday.plusDays(1).atTime(12, 0), "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Boot RESTful API & Clean Architecture",
                monday.plusDays(2).atTime(8, 0), monday.plusDays(2).atTime(12, 0), "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, devopsId, 1L, "[DEVOPS_BASIC] Docker Containerization & Microservices Basics",
                monday.plusDays(3).atTime(8, 0), monday.plusDays(3).atTime(12, 0), "Phòng Lab 201 (F-Town 2)", "SCHEDULED");
        createSession(1L, springBootId, 2L, "[SPRING_BOOT] Spring Security JWT & RBAC Practical Assessment",
                monday.plusDays(4).atTime(8, 0), monday.plusDays(4).atTime(12, 0), "Phòng Lab 201 (F-Town 2)", "SCHEDULED");

        // Afternoon sessions for class 2 (LOCAL_JAVA_02)
        createSession(2L, reactId, 5L, "[REACT_FRONTEND] React Component Lifecycle & TypeScript Setup",
                monday.atTime(13, 30), monday.atTime(17, 30), "Phòng 304 (Innovation Hall)", "SCHEDULED");
        createSession(2L, reactId, 5L, "[REACT_FRONTEND] State Management with Redux Toolkit",
                monday.plusDays(2).atTime(13, 30), monday.plusDays(2).atTime(17, 30), "Phòng 304 (Innovation Hall)", "SCHEDULED");
        createSession(2L, springBootId, 2L, "[SPRING_BOOT] Spring Security & Role Matrix Integration",
                monday.plusDays(4).atTime(13, 30), monday.plusDays(4).atTime(17, 30), "Phòng 304 (Innovation Hall)", "SCHEDULED");

        log.info("Initialized comprehensive training calendar sessions matching SRS specification.");
    }

    private void purgeOrphanedTestSessionIfNeeded() {
        // Recover if an earlier test run without @ActiveProfiles("test") wiped sessions and left only classId=101 "Existing".
        if (sessionRepository.count() == 1) {
            java.util.List<Session> testArtifacts = sessionRepository.findByClassId(101L).stream()
                    .filter(s -> Long.valueOf(500L).equals(s.getTopicId()) && "Existing".equals(s.getTitle()))
                    .toList();
            if (!testArtifacts.isEmpty()) {
                sessionRepository.deleteAll(testArtifacts);
                sessionRepository.flush();
                log.warn("Removed orphaned test session artifact (classId=101) before calendar seed check.");
            }
        }
    }

    private void ensureTrainingClasses() {
        if (trainingClassRepository != null && trainingClassRepository.count() == 0) {
            TrainingClass c1 = trainingClassRepository.save(buildSampleClass(
                    "LOCAL_JAVA_01", "Lớp Chuyên sâu Java Backend (K26)",
                    LocalDate.of(2026, 10, 1), LocalDate.of(2027, 1, 31),
                    25, "Fresher", "BACKEND_JAVA", "Nguyễn Ngọc Tân (Trainer)",
                    "Offline", "Java, Spring Boot", "Phòng Lab 201 (F-Town 2)"
            ));
            TrainingClass c2 = trainingClassRepository.save(buildSampleClass(
                    "LOCAL_JAVA_02", "Lớp Lập trình Fullstack Java Web (K26)",
                    LocalDate.of(2026, 11, 15), LocalDate.of(2027, 3, 15),
                    30, "Fresher", "FULLSTACK_JAVA", "Nguyễn Mạnh Hoàng (Trainer)",
                    "Hybrid", "Java, React", "Phòng 304 (Innovation Hall)"
            ));

            linkClassProgram(c1.getId(), "BACKEND_JAVA", "1.0");
            linkClassProgram(c2.getId(), "FULLSTACK_JAVA", "1.0");

            log.info("Initialized sample TrainingClass entities for LOCAL_JAVA_01 and LOCAL_JAVA_02.");
        }
    }

    private void linkClassProgram(Long classId, String programCode, String version) {
        if (classId == null || classTrainingProgramRepository.findByClassId(classId).isPresent()) {
            return;
        }
        trainingProgramRepository.findByCodeAndVersion(programCode, version).ifPresent(program -> {
            ClassTrainingProgram link = new ClassTrainingProgram();
            link.setClassId(classId);
            link.setProgram(program);
            link.setIsActive(true);
            classTrainingProgramRepository.save(link);
        });
    }

    private TrainingClass buildSampleClass(
            String code, String name, LocalDate startDate, LocalDate endDate,
            int plannedSize, String traineeType, String program, String masterTrainer,
            String formatType, String skills, String location) {
        TrainingClass clazz = new TrainingClass();
        clazz.setCode(code);
        clazz.setName(name);
        clazz.setStartDate(startDate);
        clazz.setEndDate(endDate);
        clazz.setStatus("active");
        clazz.setPlannedSize(plannedSize);
        clazz.setSite("TP. Hồ Chí Minh");
        clazz.setTraineeType(traineeType);
        clazz.setProgram(program);
        clazz.setClassAdmin("admin@example.com");
        clazz.setMasterTrainer(masterTrainer);
        clazz.setDeliveryType("Class");
        clazz.setFormatType(formatType);
        clazz.setSkills(skills);
        clazz.setLocation(location);
        clazz.setIsActive(true);
        return clazz;
    }

    private void createSession(Long classId, Long topicId, Long trainerId, String title,
                               LocalDateTime start, LocalDateTime end, String room, String status) {
        Session.SessionStatus sessionStatus = Session.SessionStatus.SCHEDULED;
        try {
            sessionStatus = Session.SessionStatus.valueOf(status);
        } catch (Exception ignored) {
        }

        sessionRepository.save(Session.builder()
                .classId(classId)
                .topicId(topicId)
                .trainerId(trainerId)
                .title(title)
                .startTime(start)
                .endTime(end)
                .location(room)
                .status(sessionStatus)
                .isActive(true)
                .build());
    }

    private Long resolveSubjectId(String code, String version) {
        return subjectRepository.findByCodeAndVersion(code, version)
                .map(Subject::getId)
                .orElseThrow(() -> new IllegalStateException(
                        "Required baseline subject not seeded: " + code + " v" + version));
    }
}
