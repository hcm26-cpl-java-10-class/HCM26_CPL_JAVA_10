
package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.syllabus.SyllabusCloService;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusMaterialService;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusModels;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusService;
import com.example.starter_project_2025.system.demo.syllabus.SyllabusWorkflowService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Component
@Order(14)
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = "app.seed.syllabuses.enabled",
        havingValue = "true"
)
public class SyllabusDataInitializer implements CommandLineRunner {

    private final SyllabusRepository repository;
    private final SyllabusService syllabusService;
    private final SyllabusCloService cloService;
    private final SyllabusMaterialService materialService;
    private final SyllabusWorkflowService workflow;

    private boolean alreadyExists(String code, String name) {
        return repository.existsByCodeIgnoreCase(code)
                || repository.search(name).stream()
                .anyMatch(item ->
                        item.getName().equalsIgnoreCase(name)
                );
    }

    private record Chapter(
            String title,
            String mission,
            String topicA,
            String topicB
    ) {}

    private static Chapter chapter(
            String title,
            String mission,
            String topicA,
            String topicB
    ) {
        return new Chapter(title, mission, topicA, topicB);
    }

    @Override
    @Transactional
    public void run(String... args) {

        // 1. JAVA FUNDAMENTALS - PUBLISHED
        seedReady(
                "DEMO-M3-JAVA",
                "Java Fundamentals",
                "Introduction to Java programming, object-oriented concepts and practical coding.",
                true,
                "https://docs.oracle.com/en/java/",
                "https://www.youtube.com/watch?v=iCYoaTvE9vo",
                "VIDEO",
                List.of(
                        "Explain Java syntax, data types, operators, and control flow in simple programs.",
                        "Apply object-oriented principles to design and test reusable Java classes."
                ),
                chapter(
                        "Java Basics",
                        "Build and run a Java program using variables and control flow.",
                        "Variables and Data Types",
                        "Conditions and Loops"
                ),
                chapter(
                        "Object-Oriented Java",
                        "Develop a small model using classes and objects.",
                        "Classes and Objects",
                        "Inheritance and Polymorphism"
                ),
                chapter(
                        "Java Practice",
                        "Complete a programming exercise and review the result.",
                        "Exceptions and Collections",
                        "Unit Testing Basics"
                )
        );

        // 2. SPRING BOOT - PUBLISHED
        seedReady(
                "DEMO-M3-SPRING",
                "Spring Boot for Beginners",
                "Build and test RESTful web services using Spring Boot.",
                true,
                "https://docs.spring.io/spring-boot/index.html",
                "https://www.youtube.com/watch?v=efC0Nw5rdA4",
                "VIDEO",
                List.of(
                        "Describe Spring Boot project structure and dependency injection.",
                        "Implement and test REST endpoints with controller and service layers."
                ),
                chapter(
                        "Spring Boot Introduction",
                        "Create a working Spring Boot project.",
                        "Spring Initializr and Starters",
                        "Dependency Injection"
                ),
                chapter(
                        "REST API Development",
                        "Implement endpoints for a small resource.",
                        "Controllers and Request Mapping",
                        "Validation and Error Handling"
                ),
                chapter(
                        "Data and Testing",
                        "Persist data and verify API responses.",
                        "Spring Data JPA",
                        "REST API Testing"
                )
        );

        // 3. JAVA SPRING BOOT - PUBLISHED
        seedReady(
                "DEMO-M3-JAVASPRING",
                "Java Spring Boot",
                "Create a Java backend using layered architecture and Spring Boot.",
                true,
                "https://spring.io/projects/spring-boot",
                "https://www.youtube.com/watch?v=RksqUNiIQwc",
                "VIDEO",
                List.of(
                        "Explain the interactions between controller, service and repository layers.",
                        "Develop a simple Java REST service with database operations."
                ),
                chapter(
                        "Java Web Foundations",
                        "Prepare a maintainable backend project.",
                        "Project Configuration",
                        "Spring Bean Lifecycle"
                ),
                chapter(
                        "Application Layers",
                        "Organize business logic into clear layers.",
                        "Controller and DTO Design",
                        "Service and Repository Design"
                ),
                chapter(
                        "Persistence and Security",
                        "Create a small secure data-driven API.",
                        "Database Transactions",
                        "Basic API Security"
                )
        );

        // 4. DATABASE DESIGN - PUBLISHED
        seedReady(
                "DEMO-M3-DATABASE",
                "Database Design",
                "Learn relational modelling, SQL queries and database normalization.",
                true,
                "https://www.postgresql.org/docs/current/tutorial.html",
                "https://www.youtube.com/watch?v=LuVEozf3wnU",
                "VIDEO",
                List.of(
                        "Create entity-relationship diagrams with primary and foreign keys.",
                        "Write SQL queries and normalize a relational database schema."
                ),
                chapter(
                        "Relational Modelling",
                        "Draw an ER diagram for a simple business domain.",
                        "Entities and Relationships",
                        "Primary and Foreign Keys"
                ),
                chapter(
                        "SQL Fundamentals",
                        "Query data using joins and aggregation.",
                        "Select and Filtering",
                        "Joins and Aggregation"
                ),
                chapter(
                        "Database Normalization",
                        "Improve a schema to reduce data anomalies.",
                        "Functional Dependencies",
                        "First to Third Normal Form"
                )
        );

        // 5. COMPUTER NETWORKS - DRAFT 100%
        // Test Publish manually.
        seedReady(
                "DEMO-M3-NETWORK",
                "Computer Networks Essentials",
                "Core networking concepts, TCP/IP protocols and troubleshooting fundamentals.",
                false,
                "https://www.rfc-editor.org/rfc/rfc9293",
                "https://www.rfc-editor.org/rfc/rfc9110",
                "LINK",
                List.of(
                        "Describe the main layers and protocols of the TCP/IP network model.",
                        "Analyze basic client-server traffic and common connectivity issues."
                ),
                chapter(
                        "Network Foundations",
                        "Explain how computers exchange data over networks.",
                        "Network Models",
                        "IP Addressing"
                ),
                chapter(
                        "Transport and Application",
                        "Analyze a typical client-server exchange.",
                        "TCP and UDP",
                        "HTTP and DNS"
                )
        );

        // 6. SOFTWARE TESTING - INCOMPLETE DRAFT
        // Test editing and completion progress.
        seedIncompleteDraft();

        log.info(
                "Syllabus demo seeding finished; existing syllabuses were preserved."
        );
    }

    private void seedReady(
            String code,
            String name,
            String description,
            boolean publish,
            String referenceUrl,
            String topicResourceUrl,
            String topicResourceType,
            List<String> outcomes,
            Chapter... chapters
    ) {
        if (alreadyExists(code, name)) {
            log.info("Skipped existing demo Syllabus: {}", code);
            return;
        }

        long id = syllabusService.create(
                new SyllabusModels.SyllabusInput(
                        code,
                        name,
                        description
                )
        ).id();

        // Complete General Information
        syllabusService.updateInformation(
                id,
                new SyllabusModels.InformationInput(
                        code,
                        name,
                        description,
                        "Lectures, demonstrations, guided labs, discussions, and independent practice.",
                        "Undergraduate",
                        "Lectures: 15 hours; laboratories: 30 hours; self-study: 45 hours.",
                        "Attend sessions, complete assignments, and submit learning evidence on time.",
                        "Laptop, internet connection, and course-specific development tools.",
                        10
                )
        );

        // Course Learning Outcomes
        for (String outcome : outcomes) {
            cloService.create(
                    id,
                    new SyllabusCloService.CloInput(outcome)
            );
        }

        // Sections, Missions and Topics
        Long linkedTopicId = null;

        for (int i = 0; i < chapters.length; i++) {
            Chapter chapter = chapters[i];

            var detail = syllabusService.createSection(
                    id,
                    new SyllabusModels.SectionInput(
                            chapter.title(),
                            i + 1,
                            chapter.mission()
                    )
            );

            long sectionId = detail.sections().stream()
                    .filter(section ->
                            section.title().equals(chapter.title())
                    )
                    .findFirst()
                    .orElseThrow()
                    .id();

            var afterFirstTopic = syllabusService.createTopic(
                    id,
                    sectionId,
                    new SyllabusModels.TopicInput(
                            chapter.topicA(),
                            1
                    )
            );

            if (linkedTopicId == null) {
                linkedTopicId = afterFirstTopic.sections()
                        .stream()
                        .filter(section ->
                                section.id().equals(sectionId)
                        )
                        .findFirst()
                        .orElseThrow()
                        .topics()
                        .stream()
                        .filter(topic ->
                                topic.title().equals(chapter.topicA())
                        )
                        .findFirst()
                        .orElseThrow()
                        .id();
            }

            syllabusService.createTopic(
                    id,
                    sectionId,
                    new SyllabusModels.TopicInput(
                            chapter.topicB(),
                            2
                    )
            );
        }

        // General Learning Material
        materialService.create(
                id,
                new SyllabusMaterialService.MaterialInput(
                        "Official reference for " + name,
                        "LINK",
                        referenceUrl,
                        "Documentation team",
                        "Official reference website",
                        true,
                        "General learning material for this syllabus.",
                        null
                )
        );

        // Topic-specific Learning Material
        materialService.create(
                id,
                new SyllabusMaterialService.MaterialInput(
                        "Learning resource for the first topic",
                        topicResourceType,
                        topicResourceUrl,
                        "Learning resources team",
                        "Reference publisher",
                        false,
                        "Linked to the first topic of the first section.",
                        linkedTopicId
                )
        );

        // Verify actual workflow requirements
        var progress = workflow.progress(id);

        if (!progress.canPublish()) {
            throw new IllegalStateException(
                    "Invalid demo Syllabus "
                            + code
                            + ": "
                            + progress.missing()
            );
        }

        if (publish) {
            workflow.publish(id);
        }

        log.info(
                "Seeded Syllabus {} ({}, {}%)",
                code,
                publish ? "PUBLISHED" : "DRAFT",
                progress.completionPercent()
        );
    }

    private void seedIncompleteDraft() {
        String code = "DEMO-M3-TEST";

        if (alreadyExists(code, "Software Testing Principles")) {
            log.info("Skipped existing demo Syllabus: {}", code);
            return;
        }

        long id = syllabusService.create(
                new SyllabusModels.SyllabusInput(
                        code,
                        "Software Testing Principles",
                        "Draft syllabus for experimenting with missing requirements and editing."
                )
        ).id();

        cloService.create(
                id,
                new SyllabusCloService.CloInput(
                        "Identify common software testing levels, techniques, and objectives."
                )
        );

        syllabusService.createSection(
                id,
                new SyllabusModels.SectionInput(
                        "Testing Fundamentals",
                        1,
                        ""
                )
        );

        log.info(
                "Seeded incomplete draft {} ({}%)",
                code,
                workflow.progress(id).completionPercent()
        );
    }
}
