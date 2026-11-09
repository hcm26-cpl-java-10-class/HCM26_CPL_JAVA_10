package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.session.Session;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
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
public class CalendarSessionDataInitializer implements CommandLineRunner {

    SessionRepository sessionRepository;
    SubjectRepository subjectRepository;

    @Override
    @Transactional
    public void run(String... args) {
        if (sessionRepository.count() > 0) {
            return;
        }

        Long javaCoreId = subjectRepository.findByCodeAndVersion("JAVA_CORE", "1.0")
                .map(Subject::getId).orElse(1L);
        Long springBootId = subjectRepository.findByCodeAndVersion("SPRING_BOOT", "1.0")
                .map(Subject::getId).orElse(2L);
        Long sqlId = subjectRepository.findByCodeAndVersion("DATABASE_SQL", "1.0")
                .map(Subject::getId).orElse(3L);
        Long reactId = subjectRepository.findByCodeAndVersion("REACT_FRONTEND", "1.0")
                .map(Subject::getId).orElse(4L);
        Long devopsId = subjectRepository.findByCodeAndVersion("DEVOPS_BASIC", "1.0")
                .map(Subject::getId).orElse(5L);

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
        // Đảm bảo khi bấm "Hôm nay" vẫn có dữ liệu đầy đủ
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
}
