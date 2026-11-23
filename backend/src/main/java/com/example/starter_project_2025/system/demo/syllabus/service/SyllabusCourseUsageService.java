package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCourseUsageRepository;
import com.example.starter_project_2025.system.demo.syllabus.dto.response.SyllabusCourseUsageModels.*;
import com.example.starter_project_2025.system.demo.course.Course;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.*;

/** Read-only Course Usage report; response structure and ordering are unchanged. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SyllabusCourseUsageService {
    private final SyllabusRepository syllabuses;
    private final SyllabusCourseUsageRepository usageRepository;

    public List<UsageRow> listUsage() {
        // Fetch join avoids a separate query for every Course.syllabus.
        List<Course> linked = usageRepository.findLinkedCoursesOrderedByName();

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
