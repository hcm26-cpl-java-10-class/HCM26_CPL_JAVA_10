package com.example.starter_project_2025.init;

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
public class CourseDataInitializer implements CommandLineRunner {

    static final String DOCUMENT_URL =
            "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";

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
                        document("Java quick-reference guide", DOCUMENT_URL, 2, 300)),
                section("Object-Oriented Java", 1,
                        video("Classes and objects", "https://www.youtube.com/watch?v=efC0Nw5rdA4", 0, 720),
                        text("Inheritance and polymorphism", "Explain inheritance and polymorphism, then write a small example of each.", 1, 480),
                        link("Continue with the Java documentation", "https://docs.oracle.com/en/java/", 2, 300))
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
                        document("Spring Boot reference sheet", DOCUMENT_URL, 2, 300)),
                section("Build a REST API", 1,
                        video("Controllers and request mappings", "https://www.youtube.com/watch?v=RksqUNiIQwc", 0, 720),
                        text("Service and repository layers", "Outline the responsibility of the controller, service, and repository layers.", 1, 480),
                        link("Explore Spring Boot documentation", "https://docs.spring.io/spring-boot/index.html", 2, 300))
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
                        document("Database design worksheet", DOCUMENT_URL, 2, 300)),
                section("SQL and Normalization", 1,
                        video("SQL query fundamentals", "https://www.youtube.com/watch?v=8jNG1hZEcd4", 0, 720),
                        text("Normalize a schema", "Convert an example schema to third normal form and explain each step.", 1, 480),
                        link("Practice SQL concepts", "https://www.postgresql.org/docs/current/tutorial.html", 2, 300))
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
        Course course = courseRepository.findByName(name)
                .orElseGet(Course::new);

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
                    .findFirst()
                    .orElseGet(Section::new);
            section.setCourse(course);
            section.setTitle(sectionSeed.title());
            section.setOrderIndex(sectionSeed.orderIndex());
            section.setIsActive(true);
            section = sectionRepository.save(section);

            var existingLessons = lessonRepository.findBySection_IdOrderByOrderIndexAsc(section.getId());
            for (LessonSeed lessonSeed : sectionSeed.lessons()) {
                Lesson lesson = existingLessons.stream()
                        .filter(item -> item.getOrderIndex().equals(lessonSeed.orderIndex()))
                        .findFirst()
                        .orElseGet(Lesson::new);
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
