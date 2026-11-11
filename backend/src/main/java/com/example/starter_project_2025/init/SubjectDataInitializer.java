package com.example.starter_project_2025.init;

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

        upsertSubject("JAVA_CORE_2026", "Java Core Fundamentals 2026", "1.0",
                "Core Java Programming and OOP Concepts",
                "Java", 40, true);

        upsertSubject("SPRING_BOOT_2026", "Spring Boot & Microservices 2026", "1.0",
                "Spring Boot REST API, Security, JPA and Cloud Native",
                "Java", 48, true);

        upsertSubject("REACT_TS_2026", "React & TypeScript Modern Web", "1.0",
                "Single Page Applications with React 18 and TypeScript",
                "Frontend", 36, true);

        upsertSubject("DATABASE_SQL_2026", "Relational Database & PostgreSQL", "1.0",
                "Relational database design, SQL queries and indexing",
                "Database", 24, true);

        upsertSubject("DEVOPS_DOCKER_2026", "DevOps, Docker & CI/CD Pipelines", "1.0",
                "Containerization, Docker Compose and GitHub Actions",
                "DevOps", 20, true);

        upsertSubject("AI_PYTHON_2026", "Python & Applied Machine Learning", "1.0",
                "Data analysis and ML models with Python and Scikit-Learn",
                "AI_ML", 32, true);

        upsertSubject("FRONTEND_VUE_2026", "Vue.js & Modern Frontend Architecture", "1.0",
                "Vue 3 Composition API, Pinia and TailwindCSS",
                "Frontend", 30, true);

        upsertSubject("LEGACY_JAVA_7", "Legacy Java 7 Architecture (Archived)", "1.0",
                "Deprecated legacy syllabus preserved for historical reference",
                "Java", 10, false);

        log.info("SubjectDataInitializer: ensured standard baseline subjects in H2 database.");
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
