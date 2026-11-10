package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
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

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class CourseFromSyllabusService {
    private static final int MAX_SECTIONS = 100;
    private static final int MAX_LESSONS_PER_SECTION = 200;
    private static final int MAX_TOTAL_LESSONS = 1000;

    private final CourseService courseService;
    private final CourseRepository courses;
    private final CourseMapper courseMapper;
    private final SectionService sectionService;
    private final LessonService lessonService;
    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;

    /** The preview intentionally contains ACTIVE items only, exactly as legacy creation does. */
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public Preview preview(Long syllabusId) {
        Syllabus source = eligibleSyllabus(syllabusId);
        var result = activeSections(source.getId()).stream()
                .map(section -> new SourceSection(section.getId(), section.getTitle(),
                        section.getMission(), activeTopics(section.getId()).stream()
                        .map(topic -> new SourceTopic(topic.getId(), topic.getTitle())).toList()))
                .toList();
        return new Preview(source.getId(), source.getCode(), source.getName(),
                source.getDescription(), result);
    }

    /** Finds the first unused name; uses the same existsByName check as CourseServiceImpl. */
    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE')")
    public NameSuggestion suggestName(Long syllabusId, int startAt) {
        Syllabus source = eligibleSyllabus(syllabusId);
        if (startAt < 1 || startAt > 9999) {
            throw new BusinessValidationException(Map.of("startAt", List.of("Choose a sequence from 1 to 9999")));
        }
        for (int sequence = startAt; sequence <= 9999; sequence++) {
            String suffix = String.format(Locale.ROOT, " - Class %02d", sequence);
            String name = clean(source.getName());
            name = name.substring(0, Math.min(name.length(), 150 - suffix.length())).stripTrailing() + suffix;
            if (!courses.existsByName(name)) return new NameSuggestion(name, sequence);
        }
        throw new BusinessValidationException(Map.of("name", List.of("No available class name; enter a custom name")));
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE')")
    public NameAvailability nameAvailability(Long syllabusId, String name) {
        eligibleSyllabus(syllabusId);
        String normalized = clean(name);
        return new NameAvailability(!normalized.isEmpty() && normalized.length() <= 150
                && !courses.existsByName(normalized));
    }

    /** Existing API contract remains supported for clients that do not send an editable outline. */
    @Transactional
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public CourseDTO create(CourseDTO request) {
        validateCourseRequest(request);
        Syllabus source = eligibleSyllabus(request.getSyllabusId());
        List<DraftSection> outline = activeSections(source.getId()).stream()
                .map(section -> new DraftSection(section.getTitle(), activeTopics(section.getId()).stream()
                        .map(SyllabusTopic::getTitle).toList()))
                .toList();
        return persistCourse(request, outline);
    }

    /** Only this method persists the edited preview; it never changes the Published Syllabus. */
    @Transactional
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public CourseDTO createCustomized(CreateRequest payload) {
        ValidationContext ctx = new ValidationContext();
        if (payload == null || payload.course() == null) {
            ctx.add("course", "Course information is required");
            ctx.throwIfErrors();
        }
        CourseDTO request = payload.course();
        validateCourseRequest(request);
        eligibleSyllabus(request.getSyllabusId());
        List<DraftSection> outline = normalizeAndValidateOutline(payload.sections());
        return persistCourse(request, outline);
    }

    private Syllabus eligibleSyllabus(Long id) {
        if (id == null || id <= 0) {
            throw new BusinessValidationException(Map.of("syllabusId",
                    List.of("Select a Published and Active Syllabus")));
        }
        Syllabus syllabus = syllabuses.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Syllabus not found"));
        if (syllabus.getStatus() != SyllabusStatus.PUBLISHED
                || !Boolean.TRUE.equals(syllabus.getIsActive())) {
            throw new BusinessValidationException(Map.of("syllabusId",
                    List.of("Publish and activate the Syllabus before creating a Course")));
        }
        return syllabus;
    }

    private List<SyllabusSection> activeSections(Long id) {
        return sections.findBySyllabus_IdOrderByOrderIndexAsc(id).stream()
                .filter(section -> Boolean.TRUE.equals(section.getIsActive())).toList();
    }

    private List<SyllabusTopic> activeTopics(Long sectionId) {
        return topics.findBySection_IdOrderByOrderIndexAsc(sectionId).stream()
                .filter(topic -> Boolean.TRUE.equals(topic.getIsActive())).toList();
    }

    private static void validateCourseRequest(CourseDTO request) {
        ValidationContext ctx = new ValidationContext();
        if (request == null) {
            ctx.add("course", "Course information is required");
            ctx.throwIfErrors();
        }
        if (request.getSyllabusId() == null || Boolean.TRUE.equals(request.getClearSyllabus())) {
            ctx.add("syllabusId", "Select a Published and Active Syllabus");
        }
        if (request.getStatus() != null && request.getStatus() != CourseStatus.DRAFT) {
            ctx.add("status", "Create the Course as Draft, then complete its Lessons");
        }
        String name = clean(request.getName());
        if (name.isEmpty() || name.length() > 150) {
            ctx.add("name", "Course name must contain 1 to 150 characters");
        }
        if (request.getDescription() != null && request.getDescription().length() > 500) {
            ctx.add("description", "Description must not exceed 500 characters");
        }
        if (request.getThumbnailUrl() != null && request.getThumbnailUrl().length() > 255) {
            ctx.add("thumbnailUrl", "Thumbnail URL must not exceed 255 characters");
        }
        ctx.throwIfErrors();
        request.setName(name);
    }

    static List<DraftSection> normalizeAndValidateOutline(List<DraftSection> input) {
        ValidationContext ctx = new ValidationContext();
        if (input == null || input.isEmpty()) {
            ctx.add("sections", "Add at least one Section to the Course preview");
            ctx.throwIfErrors();
        }
        if (input.size() > MAX_SECTIONS) {
            ctx.add("sections", "Too many Sections (maximum " + MAX_SECTIONS + ")");
            ctx.throwIfErrors();
        }
        List<DraftSection> normalized = new ArrayList<>();
        Set<String> sectionNames = new HashSet<>();
        int totalLessons = 0;
        for (int i = 0; i < input.size(); i++) {
            DraftSection row = input.get(i);
            String prefix = "sections[" + i + "]";
            if (row == null) {
                ctx.add(prefix, "Section is required");
                continue;
            }
            String title = clean(row.title());
            if (title.length() < 3 || title.length() > 150 || !containsLetter(title)) {
                ctx.add(prefix + ".title", "Section title must have 3-150 characters and contain letters");
            } else if (!sectionNames.add(title.toLowerCase(Locale.ROOT))) {
                ctx.add(prefix + ".title", "Section title is duplicated");
            }
            List<String> lessons = row.lessons();
            if (lessons == null || lessons.isEmpty()) {
                ctx.add(prefix + ".lessons", "Every Section must have at least one Lesson");
                continue;
            }
            if (lessons.size() > MAX_LESSONS_PER_SECTION) {
                ctx.add(prefix + ".lessons", "Too many Lessons in this Section");
                continue;
            }
            totalLessons += lessons.size();
            List<String> normalizedLessons = new ArrayList<>();
            for (int j = 0; j < lessons.size(); j++) {
                String lesson = clean(lessons.get(j));
                if (lesson.isEmpty() || lesson.length() > 200) {
                    ctx.add(prefix + ".lessons[" + j + "]", "Lesson title must contain 1-200 characters");
                }
                normalizedLessons.add(lesson);
            }
            normalized.add(new DraftSection(title, List.copyOf(normalizedLessons)));
        }
        if (totalLessons > MAX_TOTAL_LESSONS) {
            ctx.add("sections", "Too many Lessons (maximum " + MAX_TOTAL_LESSONS + ")");
        }
        ctx.throwIfErrors();
        return List.copyOf(normalized);
    }

    private static boolean containsLetter(String value) {
        return value.codePoints().anyMatch(Character::isLetter);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private CourseDTO persistCourse(CourseDTO request, List<DraftSection> outline) {
        if (outline.isEmpty()) {
            throw new BusinessValidationException(Map.of("sections", List.of("At least one active Section is required")));
        }
        request.setStatus(CourseStatus.DRAFT);
        request.setIsActive(true); // BaseEntity requires non-null; Mapper may overwrite its default.
        CourseDTO created = courseService.create(request);
        Course course = courses.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Created course not found"));
        course.setCourseType(CourseType.FROM_SYLLABUS);
        courses.save(course);

        // Spring transaction covers all nested writes. Any RuntimeException rolls everything back.
        try {
            for (int sectionIndex = 0; sectionIndex < outline.size(); sectionIndex++) {
                DraftSection source = outline.get(sectionIndex);
                SectionDTO sectionRequest = SectionDTO.builder()
                        .courseId(course.getId())
                        .title(source.title())
                        .orderIndex(sectionIndex)
                        .build();
                sectionRequest.setIsActive(true);
                SectionDTO section = sectionService.create(sectionRequest);
                for (int topicIndex = 0; topicIndex < source.lessons().size(); topicIndex++) {
                    lessonService.create(LessonDTO.builder()
                            .sectionId(section.getId())
                            .title(source.lessons().get(topicIndex))
                            .contentType(LessonContentType.TEXT)
                            .textContent("")
                            .duration(0)
                            .orderIndex(topicIndex)
                            .build());
                }
            }
        } catch (BusinessValidationException ex) {
            List<String> errors = ex.getErrors().values().stream()
                    .flatMap(List::stream).map(message -> "Course outline: " + message).toList();
            throw new BusinessValidationException(Map.of("sections", errors));
        }
        return courseMapper.toResponse(course);
    }
}
