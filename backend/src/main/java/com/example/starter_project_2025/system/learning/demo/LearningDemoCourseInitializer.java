package com.example.starter_project_2025.system.learning.demo;

import com.example.starter_project_2025.system.demo.course.CourseDTO;
import com.example.starter_project_2025.system.demo.course.CourseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.env.Environment;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.text.Normalizer;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Opt-in disposable Learning demo; never changes Course implementation or existing rows. */
@Component
@Profile("local-demo")
@ConditionalOnProperty(name = "learning.demo.courses.enabled", havingValue = "true")
@Order(20)
@RequiredArgsConstructor
@Slf4j
public class LearningDemoCourseInitializer implements CommandLineRunner {
    private final CourseService courses;
    private final DataSource dataSource;
    private final Environment environment;

    private record DemoCourse(String name, String description, String thumbnailUrl) {
        CourseDTO request() {
            var request = CourseDTO.builder().name(name).description(description)
                    .instructor("Teacher User").thumbnailUrl(thumbnailUrl).build();
            request.setIsActive(true);
            return request;
        }
    }

    private static final List<DemoCourse> DEMO_COURSES = List.of(
            new DemoCourse("Java Fundamentals", "Introduction to Java, OOP, and basic programming concepts.",
                    "https://img.youtube.com/vi/iCYoaTvE9vo/hqdefault.jpg"),
            new DemoCourse("Spring Boot for Beginners", "Learn backend APIs, Spring Boot architecture, and database integration.",
                    "https://img.youtube.com/vi/efCONw5rdA4/hqdefault.jpg"),
            new DemoCourse("Java Spring Boot", "Khóa học Java và phát triển backend với Spring Boot",
                    "https://img.youtube.com/vi/RksqUNilQwc/hqdefault.jpg"),
            new DemoCourse("Database Design", "ER diagrams, SQL, and relational design fundamentals.",
                    "https://img.youtube.com/vi/LuVEozf3wnU/hqdefault.jpg"));

    @Override
    public synchronized void run(String... args) throws Exception {
        verifyDemoTarget();
        var previous = SecurityContextHolder.getContext();
        var bootstrap = SecurityContextHolder.createEmptyContext();
        bootstrap.setAuthentication(new UsernamePasswordAuthenticationToken("learning-local-demo", null,
                List.of(new SimpleGrantedAuthority("COURSE_READ"), new SimpleGrantedAuthority("COURSE_CREATE"))));
        SecurityContextHolder.setContext(bootstrap);
        try {
            Set<String> existing = existingNames();
            int created = 0;
            for (var demo : DEMO_COURSES) {
                String name = normalize(demo.name());
                // Names are a conservative demo skip key, never an ID or a unique lookup.
                // Any matching row (including ambiguous matches) is left untouched.
                if (existing.contains(name)) continue;
                try {
                    courses.create(demo.request());
                    created++;
                } catch (RuntimeException failure) {
                    // Another initializer may have created the same name. Confirm via the
                    // existing service; do not swallow unrelated validation/storage errors.
                    if (!existingNames().contains(name)) throw failure;
                }
                existing.add(name);
            }
            log.info("Learning local demo: created {} courses; skipped {} existing names", created, DEMO_COURSES.size() - created);
        } finally {
            SecurityContextHolder.setContext(previous);
        }
    }

    private void verifyDemoTarget() throws Exception {
        var profiles = Set.of(environment.getActiveProfiles());
        if (!profiles.equals(Set.of("local-demo")) ||
                !environment.getProperty("learning.demo.courses.enabled", Boolean.class, false)) {
            throw new IllegalStateException("Learning demo requires only the local-demo profile and its explicit enable flag");
        }
        try (var connection = dataSource.getConnection()) {
            var metadata = connection.getMetaData();
            String url = metadata.getURL();
            if (!"H2".equals(metadata.getDatabaseProductName()) || url == null ||
                    !url.matches("^jdbc:h2:mem:[^;\\s]+(?:;.*)?$")) {
                throw new IllegalStateException("Learning demo requires a named in-memory H2 database; no courses were written");
            }
        }
    }

    private Set<String> existingNames() {
        Set<String> names = new HashSet<>();
        int page = 0;
        while (true) {
            var result = courses.getAll(PageRequest.of(page++, 100, Sort.by("id")), null, null);
            result.getContent().forEach(course -> names.add(normalize(course.getName())));
            if (!result.hasNext()) return names;
        }
    }

    private static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFKC)
                .strip().replaceAll("(?U)\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
