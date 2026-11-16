package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.system.subject.Subject;
import com.example.starter_project_2025.system.subject.SubjectRepository;
import com.example.starter_project_2025.system.subject.SubjectStatus;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(12)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@StartupMutation
public class SubjectDataInitializer implements CommandLineRunner {

    SubjectRepository subjectRepository;

    @Override
    @Transactional
    public void run(String... args) {
        upsertSubject("JAVA_CORE", "Java Core & OOP Fundamentals", "1.0",
                "Master Java syntax, Object-Oriented Programming, Collections framework, and Exception handling.",
                "Java", 40, true);

        upsertSubject("SPRING_BOOT", "Enterprise Backend with Spring Boot", "1.0",
                "Build enterprise RESTful APIs, Spring Data JPA, Spring Security, JWT, and validation.",
                "Java", 48, true);

        upsertSubject("DATABASE_SQL", "Relational Database Design & Optimization", "1.0",
                "ERD design, database normalization, indexing, ACID transactions, stored procedures, and query tuning.",
                "Database", 32, true);

        upsertSubject("REACT_FRONTEND", "SPA Development with React & TypeScript", "1.0",
                "React hooks, TypeScript component lifecycle, state management, routing, and REST API integration.",
                "Frontend", 40, true);

        upsertSubject("DEVOPS_BASIC", "Docker & CI/CD Pipelines for Developers", "1.0",
                "Containerization with Docker, Docker Compose, microservice deployment, and CI/CD basics.",
                "DevOps", 24, true);

        upsertSubject("TESTING_QA", "Software Testing & Unit Test Automation", "1.0",
                "Unit testing with JUnit 5, Mockito, Testcontainers, and automated API testing.",
                "Testing", 20, true);

        upsertSubject("LEGACY_JAVA_7", "Legacy Java 7 Architecture (Archived)", "1.0",
                "Deprecated legacy syllabus preserved for historical reference",
                "Java", 10, false);

        log.info("SubjectDataInitializer: ensured 7 canonical baseline subjects in H2 database.");
    }

    private void upsertSubject(String code, String name, String version,
                              String description, String technicalGroup,
                              Integer durationHours, boolean isActive) {
        if (!subjectRepository.existsByCodeAndVersion(code, version)) {
            Subject subject = Subject.builder()
                    .code(code)
                    .name(name)
                    .version(version)
                    .description(description)
                    .technicalGroup(technicalGroup)
                    .durationHours(durationHours)
                    .isActive(isActive)
                    .status(isActive ? SubjectStatus.ACTIVE : SubjectStatus.INACTIVE)
                    .build();
            subjectRepository.save(subject);
        }
    }
}
