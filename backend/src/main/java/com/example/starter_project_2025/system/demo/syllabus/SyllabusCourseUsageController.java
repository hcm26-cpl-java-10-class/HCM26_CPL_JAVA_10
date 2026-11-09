package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.system.demo.course.Course;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Read-only report. Reuses the existing Course -> Syllabus relationship. */
@RestController
@RequestMapping("/api/syllabuses/course-usage")
@RequiredArgsConstructor
public class SyllabusCourseUsageController {

    private final SyllabusRepository syllabuses;
    private final EntityManager entityManager;

    public record CourseLink(Long id, String name, String status, boolean active) {}

    public record UsageRow(
            Long syllabusId,
            String syllabusCode,
            String syllabusName,
            String syllabusStatus,
            boolean syllabusActive,
            int courseCount,
            List<CourseLink> courses
    ) {}

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_READ')")
    public List<UsageRow> listUsage() {
        // Fetch join avoids a separate query for every Course.syllabus.
        List<Course> linked = entityManager.createQuery("""
                SELECT c FROM Course c JOIN FETCH c.syllabus s
                ORDER BY c.name ASC
                """, Course.class).getResultList();

        Map<Long, List<CourseLink>> bySyllabus = new LinkedHashMap<>();
        for (Course course : linked) {
            Long id = course.getSyllabus().getId();
            bySyllabus.computeIfAbsent(id, ignored -> new ArrayList<>())
                    .add(new CourseLink(
                            course.getId(),
                            course.getName(),
                            course.getStatus() == null ? "DRAFT" : course.getStatus().name(),
                            Boolean.TRUE.equals(course.getIsActive())
                    ));
        }

        // Include Syllabuses without any Course so the user can find unused ones.
        return syllabuses.search("").stream().map(s -> {
            List<CourseLink> courses = List.copyOf(
                    bySyllabus.getOrDefault(s.getId(), List.of())
            );
            return new UsageRow(
                    s.getId(),
                    s.getCode(),
                    s.getName(),
                    s.getStatus() == null ? "DRAFT" : s.getStatus().name(),
                    Boolean.TRUE.equals(s.getIsActive()),
                    courses.size(),
                    courses
            );
        }).toList();
    }
}
