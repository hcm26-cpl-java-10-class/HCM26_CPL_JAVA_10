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

        upsertSubject("REACT_FRONTEND", "SPA Development with React & TypeScript", "1.0",
                "React hooks, TypeScript component lifecycle, state management, routing, and REST API integration.",
                "Frontend", 40, true);

        upsertSubject("DEVOPS_BASIC", "Docker & CI/CD Pipelines for Developers", "1.0",
                "Containerization with Docker, Docker Compose, microservice deployment, and CI/CD basics.",
                "DevOps", 24, true);

        upsertSubject("TESTING_QA", "Software Testing & Unit Test Automation", "1.0",
                "Unit testing with JUnit 5, Mockito, Testcontainers, and automated API testing.",
                "Testing", 20, true);

        upsertSubject("LEGACY_JSP", "Legacy Java Web Architecture (JSP & Servlet)", "0.9",
                "Legacy architecture module preserved for historical reference across previous training batches.",
                "Backend", 30, false);

        // Video topics (from FAMS frame_006.jpg & frame_009.jpg)
        upsertSubject("L1_AL_CCGM", "[NFP] Company Culture & Global Mindset (Instructor Led)", "1.0",
                "Global mindset and corporate culture integration.", "SoftSkill", 2, true);
        upsertSubject("L1_AL_GC", "[NFP] Global Collaboration", "1.0",
                "Cross-cultural collaboration and effective team cooperation.", "SoftSkill", 4, true);
        upsertSubject("L1_AL_TME", "[NFP] Time Management (E-learning)", "1.0",
                "Self-paced time management techniques for developers.", "SoftSkill", 3, true);
        upsertSubject("L1_AL_PSE", "[NFP] Problem Solving", "1.0",
                "Analytical thinking and structured problem-solving approaches.", "SoftSkill", 3, true);
        upsertSubject("L1_AL_CFFI", "[NFP] CIS Fundamentals for Freshers (Instructor Led)", "1.0",
                "Core information systems fundamentals for software engineers.", "Foundation", 16, true);
        upsertSubject("L1_AL_ECWL", "[NFP] Effective Communication with LEAP Technique (Instructor Led)", "1.0",
                "Professional communication techniques in tech workplace.", "SoftSkill", 6, true);
        upsertSubject("L1_AL_TESO", "[NFP] Teamwork Essentials", "1.0",
                "Essential agile teamwork and interpersonal dynamics.", "SoftSkill", 1, true);
        upsertSubject("L1_AL_DF", "[NFP] Database Fundamentals For All by FSA", "1.0",
                "Comprehensive relational database concepts and SQL queries.", "Database", 16, true);
        upsertSubject("L1_AL_DSAA", "[NFP] Data Structures and Algorithms for ALL by FSA", "1.0",
                "Fundamental algorithms, complexity analysis, and data structure implementations.", "Foundation", 16, true);
        upsertSubject("L1_AL_FF", "[NFP] Front-end Fundamentals", "1.0",
                "HTML5, CSS3, JavaScript ES6+, and responsive web design.", "Frontend", 9, true);
        upsertSubject("L1_AL_AAE", "[NFP] AI Augmented Engineer (20h)", "1.1",
                "AI-assisted software engineering using modern LLM tools.", "AI", 20, true);
        upsertSubject("L1_AL_APWS", "[NFP] Agile Practitioner with Scrum For All By FSA", "1.0",
                "Scrum methodology, sprint planning, and backlog refinement.", "Agile", 6, true);
        upsertSubject("L1_AL_VCG", "[NFP] Version Control - Git for ALL by FSA", "1.0",
                "Git workflows, branch strategies, conflict resolution, and pull requests.", "DevOps", 6, true);
        upsertSubject("L2_JA_JS", "[NFP] Java SE/Java Language Programing", "1.0",
                "In-depth Java standard edition, concurrency, streams, and design patterns.", "JAVA", 64, true);
        upsertSubject("L2_AN_AE", "[NFP] Angular Essentials", "1.0",
                "Angular component architecture, services, routing, and RxJS.", "Frontend", 54, true);
        upsertSubject("L2_JA_ORM", "[NFP] ORM Framework - Hibernate", "1.0",
                "JPA & Hibernate mapping, entities lifecycle, criteria queries, caching.", "JAVA", 21, true);
        upsertSubject("L3_JSFW", "[NFP] Java Spring Framework", "1.0",
                "Spring Core, Spring Boot, Spring Data JPA, and Spring Security REST APIs.", "JAVA", 39, true);
        upsertSubject("L4_MOCK_PROJECT", "[NFP] Mock Project for Fresher", "1.0",
                "Full lifecycle enterprise software development mock project.", "Project", 164, true);

        log.info("Ensured sample subject data.");
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
