package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.syllabus.dto.response.SyllabusCourseUsageModels.CourseCandidate;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCourseUsageRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Only manages the existing Course.syllabus FK. Never deletes/rewrites Course content. */
@Service
@RequiredArgsConstructor
public class SyllabusCourseLinkService {
    private final SyllabusRepository syllabuses;
    private final CourseRepository courses;
    private final SyllabusCourseUsageRepository usage;

    @Transactional(readOnly = true)
    public List<CourseCandidate> availableCourses(String search) {
        return usage.findUnlinkedCourses(search).stream()
                .map(c -> new CourseCandidate(c.getId(), c.getName(),
                        c.getStatus() == null ? "DRAFT" : c.getStatus().name(),
                        Boolean.TRUE.equals(c.getIsActive())))
                .toList();
    }

    @Transactional
    public void link(Long syllabusId, Long courseId) {
        Syllabus syllabus = syllabuses.findById(syllabusId)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found"));
        if (syllabus.getStatus() != SyllabusStatus.PUBLISHED
                || !Boolean.TRUE.equals(syllabus.getIsActive())) {
            throw new ConflictException("Only Published and Active syllabuses can be assigned");
        }
        Course course = courses.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        if (course.getSyllabus() != null) {
            if (syllabusId.equals(course.getSyllabus().getId())) {
                return; // Idempotent: already linked to the requested Syllabus.
            }
            throw new ConflictException("Course is already linked to another Syllabus. Unlink it first.");
        }
        course.setSyllabus(syllabus);
        courses.save(course);
    }

    @Transactional
    public void unlink(Long syllabusId, Long courseId) {
        Course course = courses.findById(courseId)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found"));
        if (course.getSyllabus() == null || !syllabusId.equals(course.getSyllabus().getId())) {
            throw new ConflictException("Course is not linked to this Syllabus");
        }
        if (course.getStatus() == CourseStatus.PUBLISHED) {
            throw new ConflictException("Unpublish the Course before removing its Syllabus");
        }
        course.setSyllabus(null);
        courses.save(course);
    }
}
