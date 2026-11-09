package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonDTO;
import com.example.starter_project_2025.system.demo.lesson.LessonService;
import com.example.starter_project_2025.system.demo.section.SectionDTO;
import com.example.starter_project_2025.system.demo.section.SectionService;
import com.example.starter_project_2025.system.demo.syllabus.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CourseFromSyllabusService {
    private final CourseService courseService;
    private final CourseRepository courses;
    private final CourseMapper courseMapper;
    private final SectionService sectionService;
    private final LessonService lessonService;
    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;

    @Transactional
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public CourseDTO create(CourseDTO request) {
        ValidationContext ctx = new ValidationContext();
        if (request.getSyllabusId() == null || Boolean.TRUE.equals(request.getClearSyllabus())) {
            ctx.add("syllabusId", "Select a Published and Active Syllabus");
        }
        if (request.getStatus() != null && request.getStatus() != CourseStatus.DRAFT) {
            ctx.add("status", "Create the course as Draft, then complete its lessons");
        }
        ctx.throwIfErrors();

        Syllabus syllabus = syllabuses.findById(request.getSyllabusId())
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found"));
        if (syllabus.getStatus() != SyllabusStatus.PUBLISHED
                || !Boolean.TRUE.equals(syllabus.getIsActive())) {
            ctx.add("syllabusId", "Publish and activate the Syllabus before creating a course");
        }
        List<SyllabusSection> outline = sections
                .findBySyllabus_IdOrderByOrderIndexAsc(syllabus.getId()).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive()))
                .toList();
        if (outline.isEmpty()) {
            ctx.add("syllabusId", "Syllabus must have at least one active Section");
        }
        ctx.throwIfErrors();

        request.setStatus(CourseStatus.DRAFT);
        CourseDTO created = courseService.create(request);
        Course course = courses.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Created course not found"));
        course.setCourseType(CourseType.FROM_SYLLABUS);
        courses.save(course);

        // All writes share this transaction, including the existing CRUD services.
        // Translate child validation errors to the source field in the Course form.
        try {
            for (int sectionIndex = 0; sectionIndex < outline.size(); sectionIndex++) {
                SyllabusSection source = outline.get(sectionIndex);
                SectionDTO sectionRequest = SectionDTO.builder()
                        .courseId(course.getId())
                        .title(source.getTitle())
                        .orderIndex(sectionIndex)
                        .build();
                sectionRequest.setIsActive(true);
                SectionDTO section = sectionService.create(sectionRequest);
                List<SyllabusTopic> sourceTopics = topics
                        .findBySection_IdOrderByOrderIndexAsc(source.getId()).stream()
                        .filter(topic -> Boolean.TRUE.equals(topic.getIsActive()))
                        .toList();
                for (int topicIndex = 0; topicIndex < sourceTopics.size(); topicIndex++) {
                    lessonService.create(LessonDTO.builder()
                            .sectionId(section.getId())
                            .title(sourceTopics.get(topicIndex).getTitle())
                            .contentType(LessonContentType.TEXT)
                            .textContent("")
                            .duration(0)
                            .orderIndex(topicIndex)
                            .build());
                }
            }
        } catch (BusinessValidationException ex) {
            List<String> errors = ex.getErrors().values().stream()
                    .flatMap(List::stream)
                    .map(message -> "Syllabus outline: " + message)
                    .toList();
            throw new BusinessValidationException(Map.of("syllabusId", errors));
        }
        return courseMapper.toResponse(course);
    }
}
