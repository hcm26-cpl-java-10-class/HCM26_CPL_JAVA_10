package com.example.starter_project_2025.system.demo.course;

import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Component
@Order(1000)
@ConditionalOnProperty(name="app.startup.mutations-enabled", havingValue="true", matchIfMissing=true)
public class CourseCoverBackfill implements CommandLineRunner {
    private final CourseRepository courses;
    private final CourseCoverService covers;
    public CourseCoverBackfill(CourseRepository courses, CourseCoverService covers) { this.courses=courses; this.covers=covers; }
    @Override @Transactional
    public void run(String... args) {
        for (Course course : courses.findAll()) {
            if (course.getThumbnailUrl()==null || course.getThumbnailUrl().isBlank()) covers.ensureCover(course);
        }
    }
}
