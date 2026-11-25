package com.example.starter_project_2025.init;

import com.example.starter_project_2025.config.startup.StartupMutation;

import com.example.starter_project_2025.system.demo.category.Category;
import com.example.starter_project_2025.system.demo.category.CategoryRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseLevel;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Set;

@Slf4j
@Order(13)
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
@StartupMutation
public class CourseDataInitializer implements CommandLineRunner {

    static final String DOCUMENT_URL =
            "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
    static final String AUDIO_URL =
            "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3";

    CourseRepository courseRepository;
    CategoryRepository categoryRepository;
    UserRepository userRepository;
    SectionRepository sectionRepository;
    LessonRepository lessonRepository;

    @Override
    @Transactional
    public void run(String... args) {
        User teacher = userRepository.findByEmail("teacher@example.com")
                .orElseThrow(() -> new IllegalStateException("Seed teacher not found"));

        Course java = upsertCourse(
                "Java Fundamentals",
                "Introduction to Java, OOP, and basic programming concepts.",
                "https://img.youtube.com/vi/iCYoaTvE9vo/hqdefault.jpg",
                teacher,
                category("JAVA"),
                CourseLevel.BEGINNER
        );
        seedCurriculum(java,
                section("Java Basics", 0,
                        video("Install Java and write your first program", "https://www.youtube.com/watch?v=iCYoaTvE9vo", 0, 600),
                        text("Variables and data types", "Practice declaring variables, selecting suitable data types, and printing values.", 1, 420),
                        document("Java quick-reference guide", DOCUMENT_URL, 2, 300),
                        audio("Java basics audio recap", AUDIO_URL, 3, 2),
                        link("Explore the Java tutorials", "https://docs.oracle.com/javase/tutorial/", 4, 300)),
                section("Object-Oriented Java", 1,
                        video("Classes and objects", "https://www.youtube.com/watch?v=efC0Nw5rdA4", 0, 720),
                        text("Inheritance and polymorphism", "Explain inheritance and polymorphism, then write a small example of each.", 1, 480),
                        link("Continue with the Java documentation", "https://docs.oracle.com/en/java/", 2, 300),
                        audio("Object-oriented Java audio recap", AUDIO_URL, 3, 2),
                        document("Object-oriented programming worksheet", DOCUMENT_URL, 4, 300))
        );

        Course spring = upsertCourse(
                "Spring Boot for Beginners",
                "Learn backend APIs, Spring Boot architecture, and database integration.",
                "https://img.youtube.com/vi/efC0Nw5rdA4/hqdefault.jpg",
                teacher,
                category("JAVA"),
                CourseLevel.INTERMEDIATE
        );
        seedCurriculum(spring,
                section("Spring Boot Foundations", 0,
                        video("Create a Spring Boot project", "https://www.youtube.com/watch?v=efC0Nw5rdA4", 0, 660),
                        text("Dependency injection", "Describe constructor injection and why it improves testability.", 1, 420),
                        document("Spring Boot reference sheet", DOCUMENT_URL, 2, 300),
                        audio("Spring Boot foundations audio recap", AUDIO_URL, 3, 2),
                        link("Read the Spring Boot overview", "https://spring.io/projects/spring-boot", 4, 300)),
                section("Build a REST API", 1,
                        video("Controllers and request mappings", "https://www.youtube.com/watch?v=RksqUNiIQwc", 0, 720),
                        text("Service and repository layers", "Outline the responsibility of the controller, service, and repository layers.", 1, 480),
                        link("Explore Spring Boot documentation", "https://docs.spring.io/spring-boot/index.html", 2, 300),
                        audio("REST API audio recap", AUDIO_URL, 3, 2),
                        document("REST API design worksheet", DOCUMENT_URL, 4, 300))
        );

        Course javaSpringBoot = upsertCourse(
                "Java Spring Boot",
                "Build Java web applications and REST APIs with Spring Boot.",
                "https://img.youtube.com/vi/RksqUNiIQwc/hqdefault.jpg",
                teacher,
                category("JAVA"),
                CourseLevel.INTERMEDIATE
        );
        seedCurriculum(javaSpringBoot,
                section("Java Spring Boot Fundamentals", 0,
                        video("Set up a Java Spring Boot application", "https://www.youtube.com/watch?v=efC0Nw5rdA4", 0, 660),
                        text("Understand Spring Boot configuration", "Explain auto-configuration, starters, and the application configuration file.", 1, 420),
                        document("Java Spring Boot reference sheet", DOCUMENT_URL, 2, 300),
                        audio("Java Spring Boot fundamentals audio recap", AUDIO_URL, 3, 2),
                        link("Explore Spring Initializr", "https://start.spring.io/", 4, 300)),
                section("Java Spring Boot REST APIs", 1,
                        video("Create REST controllers", "https://www.youtube.com/watch?v=RksqUNiIQwc", 0, 720),
                        text("Design service and repository layers", "Describe how controllers, services, and repositories collaborate in a Spring Boot API.", 1, 480),
                        link("Read the Spring REST guide", "https://spring.io/guides/gs/rest-service", 2, 300),
                        audio("Spring Boot REST API audio recap", AUDIO_URL, 3, 2),
                        document("Spring Boot REST API worksheet", DOCUMENT_URL, 4, 300))
        );

        Course database = upsertCourse(
                "Database Design",
                "ER diagrams, SQL, and relational design fundamentals.",
                "https://img.youtube.com/vi/LuVEozf3wnU/hqdefault.jpg",
                teacher,
                category("DATA_ANALYSIS"),
                CourseLevel.BEGINNER
        );
        seedCurriculum(database,
                section("Relational Database Basics", 0,
                        video("Tables, keys, and relationships", "https://www.youtube.com/watch?v=LuVEozf3wnU", 0, 600),
                        text("Design an ER diagram", "Identify entities, attributes, primary keys, and relationships for a small store.", 1, 480),
                        document("Database design worksheet", DOCUMENT_URL, 2, 300),
                        audio("Relational database audio recap", AUDIO_URL, 3, 2),
                        link("Read the PostgreSQL database tutorial", "https://www.postgresql.org/docs/current/tutorial-concepts.html", 4, 300)),
                section("SQL and Normalization", 1,
                        video("SQL query fundamentals", "https://www.youtube.com/watch?v=8jNG1hZEcd4", 0, 720),
                        text("Normalize a schema", "Convert an example schema to third normal form and explain each step.", 1, 480),
                        link("Practice SQL concepts", "https://www.postgresql.org/docs/current/tutorial.html", 2, 300),
                        audio("SQL and normalization audio recap", AUDIO_URL, 3, 2),
                        document("SQL normalization worksheet", DOCUMENT_URL, 4, 300))
        );

        Course addition0 = upsertCourse("REST API Development", "Hands-on practice course 7 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/efC0Nw5rdA4/hqdefault.jpg", teacher, category("WEB_DEV"), CourseLevel.INTERMEDIATE);
        seedCurriculum(addition0,
                section("Foundations", 0,
                        video("REST API Development - Foundations video", "https://www.youtube.com/watch?v=efC0Nw5rdA4&list=PLTP95OosG-qc", 0, 600),
                        audio("REST API Development - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("REST API Development - Foundations written exercise", "Complete the foundations exercise for REST API Development. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("REST API Development - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("REST API Development - Foundations further learning", "https://docs.spring.io/spring-boot/index.html", 4, 300)),
                section("Applied Practice", 1,
                        video("REST API Development - Applied practice video", "https://www.youtube.com/watch?v=LuVEozf3wnU&list=PLP-K2k4IU4UU", 0, 720),
                        audio("REST API Development - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("REST API Development - Applied practice written exercise", "Complete the applied practice exercise for REST API Development. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("REST API Development - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("REST API Development - Applied practice further learning", "https://docs.spring.io/spring-boot/index.html", 4, 300))
        );

        Course addition1 = upsertCourse("SQL for Java Developers", "Hands-on practice course 10 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/8jNG1hZEcd4/hqdefault.jpg", teacher, category("DATA_ANALYSIS"), CourseLevel.INTERMEDIATE);
        seedCurriculum(addition1,
                section("Foundations", 0,
                        video("SQL for Java Developers - Foundations video", "https://www.youtube.com/watch?v=8jNG1hZEcd4&list=PLWkCdvj8p1tQ", 0, 600),
                        audio("SQL for Java Developers - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("SQL for Java Developers - Foundations written exercise", "Complete the foundations exercise for SQL for Java Developers. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("SQL for Java Developers - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("SQL for Java Developers - Foundations further learning", "https://www.postgresql.org/docs/current/tutorial.html", 4, 300)),
                section("Applied Practice", 1,
                        video("SQL for Java Developers - Applied practice video", "https://www.youtube.com/watch?v=iCYoaTvE9vo&list=PLLV7HIWZtg0k", 0, 720),
                        audio("SQL for Java Developers - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("SQL for Java Developers - Applied practice written exercise", "Complete the applied practice exercise for SQL for Java Developers. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("SQL for Java Developers - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("SQL for Java Developers - Applied practice further learning", "https://www.postgresql.org/docs/current/tutorial.html", 4, 300))
        );

        Course addition2 = upsertCourse("Frontend Basics with React", "Hands-on practice course 11 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/iCYoaTvE9vo/hqdefault.jpg", teacher, category("WEB_DEV"), CourseLevel.ADVANCED);
        seedCurriculum(addition2,
                section("Foundations", 0,
                        video("Frontend Basics with React - Foundations video", "https://www.youtube.com/watch?v=iCYoaTvE9vo&list=PLLV7HIWZtg0k", 0, 600),
                        audio("Frontend Basics with React - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Frontend Basics with React - Foundations written exercise", "Complete the foundations exercise for Frontend Basics with React. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("Frontend Basics with React - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Frontend Basics with React - Foundations further learning", "https://developer.mozilla.org/en-US/docs/Learn_web_development", 4, 300)),
                section("Applied Practice", 1,
                        video("Frontend Basics with React - Applied practice video", "https://www.youtube.com/watch?v=efC0Nw5rdA4&list=PLTP95OosG-qc", 0, 720),
                        audio("Frontend Basics with React - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Frontend Basics with React - Applied practice written exercise", "Complete the applied practice exercise for Frontend Basics with React. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("Frontend Basics with React - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Frontend Basics with React - Applied practice further learning", "https://developer.mozilla.org/en-US/docs/Learn_web_development", 4, 300))
        );

        Course addition3 = upsertCourse("TypeScript Fundamentals", "Hands-on practice course 12 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/efC0Nw5rdA4/hqdefault.jpg", teacher, category("PROGRAMMING"), CourseLevel.ADVANCED);
        seedCurriculum(addition3,
                section("Foundations", 0,
                        video("TypeScript Fundamentals - Foundations video", "https://www.youtube.com/watch?v=efC0Nw5rdA4&list=PLTP95OosG-qc", 0, 600),
                        audio("TypeScript Fundamentals - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("TypeScript Fundamentals - Foundations written exercise", "Complete the foundations exercise for TypeScript Fundamentals. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("TypeScript Fundamentals - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("TypeScript Fundamentals - Foundations further learning", "https://developer.mozilla.org/en-US/docs/Learn_web_development", 4, 300)),
                section("Applied Practice", 1,
                        video("TypeScript Fundamentals - Applied practice video", "https://www.youtube.com/watch?v=LuVEozf3wnU&list=PLP-K2k4IU4UU", 0, 720),
                        audio("TypeScript Fundamentals - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("TypeScript Fundamentals - Applied practice written exercise", "Complete the applied practice exercise for TypeScript Fundamentals. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("TypeScript Fundamentals - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("TypeScript Fundamentals - Applied practice further learning", "https://developer.mozilla.org/en-US/docs/Learn_web_development", 4, 300))
        );

        Course addition4 = upsertCourse("Git and Team Collaboration", "Hands-on practice course 13 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/LuVEozf3wnU/hqdefault.jpg", teacher, category("PROGRAMMING"), CourseLevel.ADVANCED);
        seedCurriculum(addition4,
                section("Foundations", 0,
                        video("Git and Team Collaboration - Foundations video", "https://www.youtube.com/watch?v=LuVEozf3wnU&list=PLP-K2k4IU4UU", 0, 600),
                        audio("Git and Team Collaboration - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Git and Team Collaboration - Foundations written exercise", "Complete the foundations exercise for Git and Team Collaboration. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("Git and Team Collaboration - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Git and Team Collaboration - Foundations further learning", "https://git-scm.com/docs/gittutorial", 4, 300)),
                section("Applied Practice", 1,
                        video("Git and Team Collaboration - Applied practice video", "https://www.youtube.com/watch?v=RksqUNiIQwc&list=PLLsros4UTI0o", 0, 720),
                        audio("Git and Team Collaboration - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Git and Team Collaboration - Applied practice written exercise", "Complete the applied practice exercise for Git and Team Collaboration. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("Git and Team Collaboration - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Git and Team Collaboration - Applied practice further learning", "https://git-scm.com/docs/gittutorial", 4, 300))
        );

        Course addition5 = upsertCourse("Software Testing with JUnit", "Hands-on practice course 14 for the Course Management UI test dataset.",
                "https://img.youtube.com/vi/RksqUNiIQwc/hqdefault.jpg", teacher, category("PROGRAMMING"), CourseLevel.ADVANCED);
        seedCurriculum(addition5,
                section("Foundations", 0,
                        video("Software Testing with JUnit - Foundations video", "https://www.youtube.com/watch?v=RksqUNiIQwc&list=PLLsros4UTI0o", 0, 600),
                        audio("Software Testing with JUnit - Foundations audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Software Testing with JUnit - Foundations written exercise", "Complete the foundations exercise for Software Testing with JUnit. Explain the main concept, give one practical example, and summarize what you learned.", 2, 420),
                        document("Software Testing with JUnit - Foundations reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Software Testing with JUnit - Foundations further learning", "https://junit.org/junit5/docs/current/user-guide/", 4, 300)),
                section("Applied Practice", 1,
                        video("Software Testing with JUnit - Applied practice video", "https://www.youtube.com/watch?v=8jNG1hZEcd4&list=PLWkCdvj8p1tQ", 0, 720),
                        audio("Software Testing with JUnit - Applied practice audio recap", "https://mdn.github.io/shared-assets/audio/t-rex-roar.mp3", 1, 2),
                        text("Software Testing with JUnit - Applied practice written exercise", "Complete the applied practice exercise for Software Testing with JUnit. Explain the main concept, give one practical example, and summarize what you learned.", 2, 480),
                        document("Software Testing with JUnit - Applied practice reference document", "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", 3, 300),
                        link("Software Testing with JUnit - Applied practice further learning", "https://junit.org/junit5/docs/current/user-guide/", 4, 300))
        );

        log.info("Published demo courses and curricula ensured.");
    }

    private Course upsertCourse(
            String name,
            String description,
            String thumbnailUrl,
            User teacher,
            Category category,
            CourseLevel level
    ) {
        var existing = courseRepository.findByName(name);
        if (existing.isPresent()) return existing.get();
        Course course = new Course();

        course.setName(name);
        course.setDescription(description);
        course.setThumbnailUrl(thumbnailUrl);
        course.setInstructor(teacher.getFullName());
        course.setInstructorUser(teacher);
        course.setCategories(new LinkedHashSet<>(Set.of(category)));
        course.setStatus(CourseStatus.PUBLISHED);
        course.setLevel(level);
        course.setIsFree(true);
        course.setIsActive(true);

        return courseRepository.save(course);
    }

    private Category category(String code) {
        return categoryRepository.findByCodeIgnoreCase(code)
                .orElseThrow(() -> new IllegalStateException("Seed category not found: " + code));
    }

    private void seedCurriculum(Course course, SectionSeed... sectionSeeds) {
        var existingSections = sectionRepository.findByCourse_IdOrderByOrderIndexAsc(course.getId());
        for (SectionSeed sectionSeed : sectionSeeds) {
            Section section = existingSections.stream()
                    .filter(item -> item.getOrderIndex().equals(sectionSeed.orderIndex()))
                    .findFirst().orElse(null);
            if (section == null) {
                section = new Section();
                section.setCourse(course);
                section.setTitle(sectionSeed.title());
                section.setOrderIndex(sectionSeed.orderIndex());
                section.setIsActive(true);
                section = sectionRepository.save(section);
            }

            var existingLessons = lessonRepository.findBySection_IdOrderByOrderIndexAsc(section.getId());
            for (LessonSeed lessonSeed : sectionSeed.lessons()) {
                // Preserve edited lessons, including inactive records; add only missing positions.
                if (existingLessons.stream().anyMatch(item -> item.getOrderIndex().equals(lessonSeed.orderIndex()))) continue;
                Lesson lesson = new Lesson();
                lesson.setSection(section);
                lesson.setTitle(lessonSeed.title());
                lesson.setContentType(lessonSeed.contentType());
                lesson.setContentUrl(lessonSeed.contentUrl());
                lesson.setTextContent(lessonSeed.textContent());
                lesson.setDuration(lessonSeed.duration());
                lesson.setOrderIndex(lessonSeed.orderIndex());
                lesson.setIsActive(true);
                lessonRepository.save(lesson);
            }
        }
    }

    private static SectionSeed section(String title, int orderIndex, LessonSeed... lessons) {
        return new SectionSeed(title, orderIndex, lessons);
    }

    private static LessonSeed video(String title, String url, int orderIndex, int duration) {
        return new LessonSeed(title, LessonContentType.VIDEO, url, null, orderIndex, duration);
    }

    private static LessonSeed audio(String title, String url, int orderIndex, int duration) {
        return new LessonSeed(title, LessonContentType.AUDIO, url, null, orderIndex, duration);
    }

    private static LessonSeed text(String title, String content, int orderIndex, int duration) {
        return new LessonSeed(title, LessonContentType.TEXT, null, content, orderIndex, duration);
    }

    private static LessonSeed document(String title, String url, int orderIndex, int duration) {
        return new LessonSeed(title, LessonContentType.DOCUMENT, url, null, orderIndex, duration);
    }

    private static LessonSeed link(String title, String url, int orderIndex, int duration) {
        return new LessonSeed(title, LessonContentType.LINK, url, null, orderIndex, duration);
    }

    private record SectionSeed(String title, int orderIndex, LessonSeed[] lessons) {}

    private record LessonSeed(
            String title,
            LessonContentType contentType,
            String contentUrl,
            String textContent,
            int orderIndex,
            int duration
    ) {}
}
