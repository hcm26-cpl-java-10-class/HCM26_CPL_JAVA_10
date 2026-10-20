package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
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
public class CourseDataInitializer implements CommandLineRunner {

    CourseRepository courseRepository;

    @Override
    @Transactional
    public void run(String... args) {
        upsertCourse(
                "Java Fundamentals",
                "Introduction to Java, OOP, and basic programming concepts.",
                "https://example.com/java-fundamentals.jpg",
                "Nguyen Van A"
        );

        upsertCourse(
                "Spring Boot for Beginners",
                "Learn backend APIs, Spring Boot architecture, and database integration.",
                "https://example.com/spring-boot.jpg",
                "Tran Thi B"
        );

        upsertCourse(
                "Database Design",
                "ER diagrams, SQL, and relational design fundamentals.",
                "https://example.com/database-design.jpg",
                "Le Van C"
        );

        log.info("Course default data ensured.");
    }

    private void upsertCourse(String name, String description, String thumbnailUrl, String instructor) {
        Course course = courseRepository.findByName(name)
                .orElseGet(Course::new);

        course.setName(name);
        course.setDescription(description);
        course.setThumbnailUrl(thumbnailUrl);
        course.setInstructor(instructor);

        courseRepository.save(course);
    }
}