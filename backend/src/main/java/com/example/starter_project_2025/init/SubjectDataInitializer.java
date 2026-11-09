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
                "Backend", 40, true);

        upsertSubject("SPRING_BOOT", "Enterprise Backend with Spring Boot", "1.0",
                "Build enterprise RESTful APIs, Spring Data JPA, Spring Security, JWT, and validation.",
                "Backend", 48, true);

        upsertSubject("DATABASE_SQL", "Relational Database Design & Optimization", "1.0",
                "ERD design, database normalization, indexing, ACID transactions, stored procedures, and query tuning.",
                "Database", 32, true);

        log.info("Ensured clean sample subject data (3 topics).");
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
