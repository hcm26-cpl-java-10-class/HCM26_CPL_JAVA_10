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

        LocalDate now = LocalDate.now();
        // Determine start of current week (Monday)
        LocalDate monday = now.minusDays(now.getDayOfWeek().getValue() - 1);

        createSession(1L, javaCoreId, 1L, "Java Core - OOP & Inheritance",
                monday.atTime(8, 30), monday.atTime(11, 30), "Phòng Lab 201", "COMPLETED");
        createSession(1L, javaCoreId, 1L, "Java Core - Collections & Generics",
                monday.plusDays(1).atTime(8, 30), monday.plusDays(1).atTime(11, 30), "Phòng Lab 201", "SCHEDULED");
        createSession(1L, javaCoreId, 1L, "Java Core - Stream API & Concurrency",
                monday.plusDays(2).atTime(8, 30), monday.plusDays(2).atTime(11, 30), "Phòng Lab 201", "SCHEDULED");
        createSession(1L, sqlId, 1L, "SQL Database - Schema Design & Indexes",
                monday.plusDays(3).atTime(8, 30), monday.plusDays(3).atTime(11, 30), "Phòng Lab 201", "SCHEDULED");
        createSession(1L, springBootId, 1L, "Spring Boot - REST API & JPA Entities",
                monday.plusDays(4).atTime(8, 30), monday.plusDays(4).atTime(11, 30), "Phòng Lab 201", "SCHEDULED");

        // Afternoon sessions for class 2
        createSession(2L, reactId, 1L, "React TS - Component Lifecycle & Hooks",
                monday.atTime(13, 30), monday.atTime(16, 30), "Phòng Lab 202", "SCHEDULED");
        createSession(2L, reactId, 1L, "React TS - State Management with Redux",
                monday.plusDays(2).atTime(13, 30), monday.plusDays(2).atTime(16, 30), "Phòng Lab 202", "SCHEDULED");
        createSession(2L, springBootId, 1L, "Spring Security - JWT & Role RBAC",
                monday.plusDays(4).atTime(13, 30), monday.plusDays(4).atTime(16, 30), "Phòng Lab 202", "SCHEDULED");

        log.info("Initialized sample Training Calendar Sessions for class 1 and class 2.");
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
