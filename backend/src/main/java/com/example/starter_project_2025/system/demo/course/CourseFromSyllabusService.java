package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonDTO;
import com.example.starter_project_2025.system.demo.lesson.LessonService;
import com.example.starter_project_2025.system.demo.section.SectionDTO;
import com.example.starter_project_2025.system.demo.section.SectionService;
import lombok.RequiredArgsConstructor;
import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.system.exam.core.dto.ExamDTO;
import com.example.starter_project_2025.system.exam.core.domain.ExamCategory;
import com.example.starter_project_2025.system.exam.core.service.ExamServiceImpl;
import jakarta.validation.Validator;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

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
    private final LessonRepository lessonRepository;
    private final SectionRepository courseSections;
    private final SyllabusRepository syllabuses;
    private final SyllabusSectionRepository sections;
    private final SyllabusTopicRepository topics;
    private final ExamServiceImpl examService;
    private final Validator validator;

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
            String suffix = String.format(Locale.ROOT, " - Course %02d", sequence);
            String name = clean(source.getName());
            name = name.substring(0, Math.min(name.length(), 150 - suffix.length())).stripTrailing() + suffix;
            String proposed = CourseSourceScope.nameKey(name);
            if (!courses.existsByName(name) && courses.findAllCourseNames().stream()
                    .noneMatch(existing -> proposed.equals(CourseSourceScope.nameKey(existing)))) {
                return new NameSuggestion(name, sequence);
            }
        }
        throw new BusinessValidationException(Map.of("name", List.of("No available Course name; enter a custom name")));
    }

    @Transactional(readOnly = true)
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE')")
    public NameAvailability nameAvailability(Long syllabusId, String name) {
        eligibleSyllabus(syllabusId);
        String normalized = clean(name);
        String key = CourseSourceScope.nameKey(normalized);
        return new NameAvailability(!normalized.isEmpty() && normalized.length() <= 150
                && !courses.existsByName(normalized)
                && courses.findAllCourseNames().stream()
                    .noneMatch(existing -> key.equals(CourseSourceScope.nameKey(existing))));
    }

    /** Existing API contract remains supported for clients that do not send an editable outline. */
    @Transactional
    @PreAuthorize("hasAuthority('SYLLABUS_READ') and hasAuthority('COURSE_CREATE') "
            + "and hasAuthority('SECTION_CREATE') and hasAuthority('LESSON_CREATE')")
    public CourseDTO create(CourseDTO request) {
        validateCourseRequest(request);
        Syllabus source = eligibleSyllabus(request.getSyllabusId());
        List<Long> ids = activeSections(source.getId()).stream()
                .flatMap(section -> activeTopics(section.getId()).stream())
                .map(SyllabusTopic::getId).toList();
        List<DraftSection> sourced = activeSections(source.getId()).stream()
                .filter(section -> !activeTopics(section.getId()).isEmpty())
                .map(section -> new DraftSection(section.getTitle(),
                        activeTopics(section.getId()).stream().map(SyllabusTopic::getTitle).toList(),
                        activeTopics(section.getId()).stream().map(SyllabusTopic::getId).toList()))
                .toList();
        // Keep the legacy endpoint callable; create source-derived introductory materials.
        // The new customized editor requires authored lesson materials for every Lesson.
        List<DraftSection> withSourceNotes = sourced.stream().map(section ->
                new DraftSection(section.title(), section.lessons(), section.sourceTopicIds(),
                        section.lessons().stream().map(title -> sourceNotes(title, section.title())).toList()))
                .toList();
        return persistCourse(request, normalizeAndValidateOutline(withSourceNotes), validateTopicScope(source.getId(), ids), List.of());
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
        Syllabus source = eligibleSyllabus(request.getSyllabusId());
        List<DraftSection> outline = normalizeAndValidateOutline(payload.sections());
        validateAssessmentRequests(outline);
        // Only new clients include selectedTopicIds; old API payloads remain compatible.
        List<Long> selected = payload.selectedTopicIds() == null ? List.of()
                : validateTopicScope(source.getId(), payload.selectedTopicIds());
        if (payload.selectedTopicIds() != null) validateMappedLessons(outline, selected);
        return persistCourse(request, outline, selected, payload.resources());
    }

    /** ID-based scope: Full and Focused-with-all-topics yield the same key. */
    @Transactional(readOnly = true)
    public ScopeCheck checkScope(Long syllabusId, List<Long> ids) {
        Syllabus source = eligibleSyllabus(syllabusId);
        List<Long> selected = validateTopicScope(source.getId(), ids);
        return checkKnownScope(source.getId(), selected);
    }

    private ScopeCheck checkKnownScope(Long syllabusId, List<Long> selected) {
        // This advisory check does not reject equal Topic sets: a deeper/different Course is allowed.
        long matches = 0, unverified = 0;
        Long firstId = null;
        String firstName = null;
        for (Course existing : courses.findBySyllabus_Id(syllabusId)) {
            List<Long> scope = knownScope(syllabusId, existing);
            if (scope == null) { unverified++; continue; }
            if (scope.equals(selected)) {
                matches++;
                if (firstId == null) { firstId = existing.getId(); firstName = existing.getName(); }
            }
        }
        return new ScopeCheck(false, firstId, firstName, unverified, matches);
    }

    /** A missing/ambiguous match is NOT proof of coverage. Never guess IDs. */
    private List<Long> reconstructLegacyScope(Long syllabusId, Long courseId) {
        Map<String, Map<String, Long>> source = new java.util.HashMap<>();
        for (SyllabusSection section : activeSections(syllabusId)) {
            String sectionName = CourseSourceScope.nameKey(section.getTitle());
            if (source.containsKey(sectionName)) return null;
            Map<String, Long> byTitle = new java.util.HashMap<>();
            for (SyllabusTopic topic : activeTopics(section.getId())) {
                String topicName = CourseSourceScope.nameKey(topic.getTitle());
                if (byTitle.putIfAbsent(topicName, topic.getId()) != null) return null;
            }
            source.put(sectionName, byTitle);
        }
        Set<Long> mapped = new HashSet<>();
        var rows = courseSections.findByCourse_IdOrderByOrderIndexAsc(courseId);
        if (rows.isEmpty()) return null;
        for (var courseSection : rows) {
            var candidateTopics = source.get(CourseSourceScope.nameKey(courseSection.getTitle()));
            if (candidateTopics == null) return null;
            var courseLessons = lessonRepository.findBySection_IdOrderByOrderIndexAsc(courseSection.getId());
            if (courseLessons.isEmpty()) return null;
            for (var lesson : courseLessons) {
                Long topic = candidateTopics.get(CourseSourceScope.nameKey(lesson.getTitle()));
                if (topic == null || !mapped.add(topic)) return null;
            }
        }
        return CourseSourceScope.canonical(new ArrayList<>(mapped));
    }

    /** Public for AI suggestion validation; only active Topics of this Syllabus are allowed. */
    @Transactional(readOnly = true)
    public List<Long> validateTopicScope(Long syllabusId, List<Long> ids) {
        if (ids == null || ids.isEmpty() || ids.size() > MAX_TOTAL_LESSONS ||
                ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new BusinessValidationException(Map.of("selectedTopicIds",
                    List.of("Select 1 to " + MAX_TOTAL_LESSONS + " valid active Topics")));
        }
        Set<Long> available = new HashSet<>();
        activeSections(syllabusId).forEach(section -> activeTopics(section.getId())
                .forEach(topic -> available.add(topic.getId())));
        if (!available.containsAll(ids) || new HashSet<>(ids).size() != ids.size()) {
            throw new BusinessValidationException(Map.of("selectedTopicIds",
                    List.of("Selected Topics must be distinct, active, and belong to this Syllabus")));
        }
        return CourseSourceScope.canonical(ids);
    }

    /** AI may expand one Topic into several Lessons and add unmapped supplementary Lessons. */
    private static void validateMappedLessons(List<DraftSection> outline, List<Long> selected) {
        List<Long> mapped = outline.stream().flatMap(section ->
                (section.sourceTopicIds() == null ? java.util.stream.Stream.<Long>empty()
                        : section.sourceTopicIds().stream().filter(java.util.Objects::nonNull)))
                .toList();
        Set<Long> allowed = new HashSet<>(selected);
        if (!allowed.containsAll(mapped) || !new HashSet<>(mapped).containsAll(allowed)) {
            throw new BusinessValidationException(Map.of("sections", List.of(
                    "Every selected Topic needs at least one linked Lesson. "
                            + "Lessons may expand a Topic; supplementary Lessons have no source Topic ID.")));
        }
    }

    /** V1 rows store a scope hash, V2 rows store a scope+outline hash; IDs are in sourceTopicIds. */
    private List<Long> knownScope(Long syllabusId, Course course) {
        if (course.getSourceTopicIds() != null && !course.getSourceTopicIds().isBlank()) {
            try {
                return CourseSourceScope.canonical(java.util.Arrays.stream(course.getSourceTopicIds().split(","))
                        .map(Long::valueOf).toList());
            } catch (NumberFormatException ex) { return null; }
        }
        return reconstructLegacyScope(syllabusId, course.getId());
    }

    private boolean sameOutline(Long courseId, List<DraftSection> proposed) {
        var previous = courseSections.findByCourse_IdOrderByOrderIndexAsc(courseId);
        if (previous.size() != proposed.size()) return false;
        for (int i = 0; i < previous.size(); i++) {
            if (!CourseSourceScope.nameKey(previous.get(i).getTitle())
                    .equals(CourseSourceScope.nameKey(proposed.get(i).title()))) return false;
            var lessons = lessonRepository.findBySection_IdOrderByOrderIndexAsc(previous.get(i).getId());
            if (lessons.size() != proposed.get(i).lessons().size()) return false;
            for (int j = 0; j < lessons.size(); j++) {
                if (!CourseSourceScope.nameKey(lessons.get(j).getTitle())
                        .equals(CourseSourceScope.nameKey(proposed.get(i).lessons().get(j)))) return false;
            }
        }
        return true;
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
            List<Long> topicIds = row.sourceTopicIds();
            if (topicIds != null && topicIds.size() != lessons.size()) {
                ctx.add(prefix + ".sourceTopicIds", "Source Topic mapping must align with Lessons");
            }
            List<String> materials = row.lessonMaterials();
            if (materials != null && materials.size() != lessons.size()) {
                ctx.add(prefix + ".lessonMaterials", "Lesson materials must align with Lessons");
            }
            List<String> normalizedMaterials = new ArrayList<>();
            // The Course editor supports eight native Lesson content types.
            // Keep backward-compatible default TEXT for older API requests.
            List<LessonContentType> types = row.lessonTypes();
            if (types != null && types.size() != lessons.size()) {
                ctx.add(prefix + ".lessonTypes", "Lesson content types must align with Lessons");
            }
            List<String> urls = row.lessonUrls();
            if (urls != null && urls.size() != lessons.size()) {
                ctx.add(prefix + ".lessonUrls", "Lesson URLs must align with Lessons");
            }
            List<Integer> durations = row.lessonDurations();
            if (durations != null && durations.size() != lessons.size()) {
                ctx.add(prefix + ".lessonDurations", "Lesson durations must align with Lessons");
            }
            List<ExamDTO> assessments = row.lessonAssessments();
            if (assessments != null && assessments.size() != lessons.size()) {
                ctx.add(prefix + ".lessonAssessments", "Assessment configurations must align with Lessons");
            }
            List<ExamDTO> normalizedAssessments = new ArrayList<>();
            List<LessonContentType> normalizedTypes = new ArrayList<>();
            List<String> normalizedUrls = new ArrayList<>();
            List<Integer> normalizedDurations = new ArrayList<>();
            for (int j = 0; j < lessons.size(); j++) {
                LessonContentType type = types != null && j < types.size() ? types.get(j) : LessonContentType.TEXT;
                if (type == null) {
                    ctx.add(prefix + ".lessonTypes[" + j + "]", "Lesson content type is required");
                    type = LessonContentType.TEXT;
                }
                String material = materials != null && j < materials.size() && materials.get(j) != null
                        ? materials.get(j).strip() : "";
                boolean assessment = isAssessmentHeading(type);
                if (type == LessonContentType.TEXT && (material.length() < 80 || material.length() > 12000)) {
                    ctx.add(prefix + ".lessonMaterials[" + j + "]",
                            "Text Lesson material must contain 80-12000 characters of instructional content");
                } else if (!assessment && material.length() > 12000) {
                    ctx.add(prefix + ".lessonMaterials[" + j + "]", "Learning notes must not exceed 12000 characters");
                }
                ExamDTO config = assessments != null && j < assessments.size() ? assessments.get(j) : null;
                if (config != null) {
                    String field = prefix + ".lessonAssessments[" + j + "]";
                    if (!assessment || !assessmentCategoryMatches(type, config.getCategory())) {
                        ctx.add(field, "Assessment category must match Lesson type");
                    }
                    if (!normalizedLessons.get(j).equals(clean(config.getTitle()))) {
                        ctx.add(field, "Assessment title must match Lesson title");
                    }
                    if (config.getDurationMinutes() == null || config.getDurationMinutes() < 1
                            || config.getDurationMinutes() > Integer.MAX_VALUE / 60) {
                        ctx.add(field, "Assessment duration must be a positive whole number of minutes within range");
                    }
                    if (config.getExamType() == null) ctx.add(field, "Select a question format");
                    if (config.getId() != null || config.getCourseId() != null || config.getSectionId() != null
                            || config.getLessonId() != null) {
                        ctx.add(field, "Only a new assessment configuration without existing IDs is allowed");
                    }
                    if (config.getQuestionIds() != null) {
                        var ids = config.getQuestionIds();
                        if (ids.stream().anyMatch(id -> id == null || id <= 0)
                                || new java.util.HashSet<>(ids).size() != ids.size()) {
                            ctx.add(field + ".questionIds", "Question IDs must be positive and unique");
                        }
                    }
                    if (material.isEmpty() || material.length() > 12000) {
                        ctx.add(field, "Assessment instructions must contain 1-12000 characters");
                    }
                }
                normalizedAssessments.add(config);
                // Configured assessments retain instructions only; legacy headings have no content.
                normalizedMaterials.add(assessment && config == null ? "" : material);
                String url = urls != null && j < urls.size() && urls.get(j) != null
                        ? urls.get(j).strip() : "";
                boolean resource = switch (type) {
                    case VIDEO, AUDIO, DOCUMENT, LINK -> true;
                    default -> false;
                };
                // This endpoint always creates FROM_SYLLABUS DRAFT; a blank URL is a planned heading.
                // Nonblank URLs remain strictly validated, and Publish checks are unchanged.
                if (resource && !url.isBlank() && !validResourceUrl(url)) {
                    ctx.add(prefix + ".lessonUrls[" + j + "]",
                            type + " lessons require a valid http/https URL of at most 500 characters");
                }
                Integer duration = durations != null && j < durations.size() ? durations.get(j) : 0;
                if (duration == null || duration < 0) {
                    ctx.add(prefix + ".lessonDurations[" + j + "]", "Duration must be non-negative");
                    duration = 0;
                }
                normalizedTypes.add(type);
                normalizedUrls.add(resource ? url : "");
                normalizedDurations.add(config != null && config.getDurationMinutes() != null
                        && config.getDurationMinutes() > 0 && config.getDurationMinutes() <= Integer.MAX_VALUE / 60
                        ? config.getDurationMinutes() * 60 : duration);
            }
            normalized.add(new DraftSection(title, List.copyOf(normalizedLessons),
                    topicIds == null ? null : Collections.unmodifiableList(new ArrayList<>(topicIds)),
                    Collections.unmodifiableList(normalizedMaterials), List.copyOf(normalizedTypes),
                    List.copyOf(normalizedUrls), List.copyOf(normalizedDurations),
                    Collections.unmodifiableList(normalizedAssessments)));
        }
        if (totalLessons > MAX_TOTAL_LESSONS) {
            ctx.add("sections", "Too many Lessons (maximum " + MAX_TOTAL_LESSONS + ")");
        }
        ctx.throwIfErrors();
        return List.copyOf(normalized);
    }

    static boolean assessmentCategoryMatches(LessonContentType type, ExamCategory category) {
        return switch (type) {
            case QUIZ -> category == ExamCategory.QUIZ;
            case ASSIGNMENT -> category == ExamCategory.ASSIGNMENT;
            case EXAM -> category == ExamCategory.MIDTERM || category == ExamCategory.FINAL_TEST;
            default -> false;
        };
    }

    /** The native assessment service performs its own business validation and permission checks. */
    private void validateAssessmentRequests(List<DraftSection> outline) {
        ValidationContext ctx = new ValidationContext();
        java.math.BigDecimal total = java.math.BigDecimal.ZERO;
        for (DraftSection section : outline) {
            if (section.lessonAssessments() == null) continue;
            for (ExamDTO config : section.lessonAssessments()) {
                if (config == null) continue;
                var authentication = SecurityContextHolder.getContext().getAuthentication();
                if (authentication == null || authentication.getAuthorities().stream()
                        .noneMatch(a -> "EXAM_CREATE".equals(a.getAuthority()))) {
                    throw new AccessDeniedException("Assessment creation permission is required");
                }
                if (config.getQuestionIds() != null && !config.getQuestionIds().isEmpty()
                        && authentication.getAuthorities().stream().noneMatch(a -> "QUESTION_READ".equals(a.getAuthority()))) {
                    throw new AccessDeniedException("Question library permission is required");
                }
                validator.validate(config, OnCreate.class).forEach(v ->
                        ctx.add("lessonAssessments." + v.getPropertyPath(), v.getMessage()));
                if (config.getCourseWeight() != null) total = total.add(config.getCourseWeight());
            }
        }
        if (total.compareTo(java.math.BigDecimal.valueOf(100)) > 0) {
            ctx.add("lessonAssessments.courseWeight", "Course assessment weights must not exceed 100%");
        }
        ctx.throwIfErrors();
    }

    /** Minimal source-derived notes for callers of the original outline-only endpoint.
     * Customized Manual/AI creation NEVER substitutes a placeholder for user material. */
    private static String sourceNotes(String title, String section) {
        return "# " + title + "\n\nThis lesson develops the Syllabus topic " + title
                + " within " + section + ".\n\nLearning objectives: Explain the key ideas, "
                + "give relevant examples, and describe how the topic applies to practical work."
                + "\n\nActivity: Develop and explain a concrete example that demonstrates " + title
                + ". Record your reasoning and check your result against the Syllabus.";
    }

    private static boolean isAssessmentHeading(LessonContentType type) {
        return switch (type) {
            case QUIZ, EXAM, ASSIGNMENT -> true;
            default -> false;
        };
    }

    /** Only stores resource URLs. External URLs are not fetched by this service. */
    private static boolean validResourceUrl(String value) {
        if (value == null || value.isBlank() || value.length() > 500) return false;
        try {
            java.net.URI uri = java.net.URI.create(value);
            String scheme = uri.getScheme();
            return ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme))
                    && uri.getHost() != null && !uri.getHost().isBlank();
        } catch (IllegalArgumentException ex) { return false; }
    }

    private static boolean containsLetter(String value) {
        return value.codePoints().anyMatch(Character::isLetter);
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim().replaceAll("\\s+", " ");
    }

    private CourseDTO persistCourse(CourseDTO request, List<DraftSection> outline, List<Long> selected, List<AiResource> resources) {
        if (outline.isEmpty()) {
            throw new BusinessValidationException(Map.of("sections", List.of("At least one active Section is required")));
        }
        String resourceText = formatResources(resources);
        if (!resourceText.isBlank() && outline.stream().flatMap(section -> section.lessonTypes().stream())
                .allMatch(CourseFromSyllabusService::isAssessmentHeading)) {
            throw new BusinessValidationException(Map.of("resources", List.of(
                    "Remove external references or add a learning Lesson to attach them")));
        }
        boolean referencesAttached = false;
        // Compare the actual outline, not just Topic scope: two courses may teach
        // the same Topic set at different depths, but exact repeats are blocked.
        if (!selected.isEmpty()) {
            for (Course previous : courses.findBySyllabus_Id(request.getSyllabusId())) {
                List<Long> previousScope = knownScope(request.getSyllabusId(), previous);
                if (selected.equals(previousScope) && sameOutline(previous.getId(), outline)) {
                    throw new ConflictException("Course " + previous.getName()
                            + " already uses the same selected Topics and Course outline.");
                }
            }
        }
        String normalizedName = CourseSourceScope.nameKey(request.getName());
        if (courses.findAllCourseNames().stream().anyMatch(name ->
                normalizedName.equals(CourseSourceScope.nameKey(name)))) {
            throw new ConflictException("Course name already exists (ignoring capitalization and extra spaces).");
        }
        request.setStatus(CourseStatus.DRAFT);
        request.setIsActive(true); // BaseEntity requires non-null; Mapper may overwrite its default.
        CourseDTO created;
        try {
            created = courseService.create(request);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new ConflictException("Course name already exists.");
        }
        Course course = courses.findById(created.getId())
                .orElseThrow(() -> new IllegalStateException("Created course not found"));
        course.setCourseType(CourseType.FROM_SYLLABUS);
        if (!selected.isEmpty()) {
            course.setSourceTopicScopeKey(CourseSourceScope.outlineKey(selected, outline));
            course.setSourceTopicIds(CourseSourceScope.idsCsv(selected));
        }
        // DB unique (syllabus_id, scope_key) protects identical normalized outlines
        // during concurrent Manual/AI requests without changing the V1 H2 schema.
        try {
            courses.saveAndFlush(course);
        } catch (org.springframework.dao.DataIntegrityViolationException ex) {
            throw new ConflictException("Course name or identical Syllabus Course outline is already in use.");
        }

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
                    LessonContentType type = source.lessonTypes().get(topicIndex);
                    String textContent = source.lessonMaterials().get(topicIndex);
                    ExamDTO assessment = source.lessonAssessments() == null ? null : source.lessonAssessments().get(topicIndex);
                    if (!referencesAttached && !resourceText.isBlank() && !isAssessmentHeading(type)) {
                        textContent += "\n\n## Additional verified references\n" + resourceText;
                        referencesAttached = true;
                    }
                    LessonDTO lessonRequest = LessonDTO.builder()
                            .sectionId(section.getId())
                            .title(source.lessons().get(topicIndex))
                            .contentType(type)
                            .contentUrl(source.lessonUrls().get(topicIndex).isBlank() ? null : source.lessonUrls().get(topicIndex))
                            .textContent(isAssessmentHeading(type) && assessment == null ? null : textContent)
                            .duration(source.lessonDurations().get(topicIndex))
                            .orderIndex(topicIndex)
                            .build();
                    lessonRequest.setIsActive(true);
                    LessonDTO createdLesson = lessonService.create(lessonRequest);
                    if (assessment != null) {
                        if (createdLesson == null || createdLesson.getId() == null) {
                            throw new IllegalStateException("Created Lesson has no ID for assessment linking");
                        }
                        assessment.setId(null);
                        // Native ExamService treats null as no questions, but rejects an empty list.
                        if (assessment.getQuestionIds() != null && assessment.getQuestionIds().isEmpty()) {
                            assessment.setQuestionIds(null);
                        }
                        assessment.setIsActive(true);
                        assessment.setTitle(source.lessons().get(topicIndex));
                        assessment.setCourseId(course.getId());
                        assessment.setSectionId(section.getId());
                        assessment.setLessonId(createdLesson.getId());
                        // Same service as AssessmentLessonController, inside this Course transaction.
                        examService.create(assessment);
                    }
                    Long topicId = source.sourceTopicIds() == null ? null
                            : source.sourceTopicIds().get(topicIndex);
                    if (topicId != null) {
                        if (createdLesson == null || createdLesson.getId() == null) {
                            throw new IllegalStateException("Created Lesson has no ID for source mapping");
                        }
                        var lesson = lessonRepository.findById(createdLesson.getId())
                                .orElseThrow(() -> new IllegalStateException("Created Lesson missing"));
                        lesson.setSourceSyllabusTopicId(topicId);
                        lessonRepository.save(lesson);
                    }
                }
            }
        } catch (BusinessValidationException ex) {
            List<String> errors = ex.getErrors().values().stream()
                    .flatMap(List::stream).map(message -> "Course outline: " + message).toList();
            throw new BusinessValidationException(Map.of("sections", errors));
        }
        return courseMapper.toResponse(course);
    }
    /** Plain-text references in the first non-assessment Lesson; users can edit them later in Curriculum.
     *  No unverified AI-authored URL is silently made into a learning resource. */
    private static String formatResources(List<AiResource> resources) {
        if (resources == null || resources.isEmpty()) return "";
        if (resources.size() > 6) throw new BusinessValidationException(Map.of(
                "resources", List.of("At most 6 references are allowed")));
        StringBuilder result = new StringBuilder("Suggested external learning resources (review before use):\n");
        Set<String> seen = new HashSet<>();
        for (AiResource item : resources) {
            if (item == null || item.title() == null || item.url() == null) {
                throw new BusinessValidationException(Map.of("resources", List.of("Resource title and URL are required")));
            }
            String title = clean(item.title());
            String url = item.url().strip();
            boolean valid;
            try {
                var parsed = java.net.URI.create(url);
                valid = "https".equalsIgnoreCase(parsed.getScheme())
                        && parsed.getHost() != null
                        && !parsed.getHost().equalsIgnoreCase("localhost")
                        && !parsed.getHost().matches("(?i)(127\\..*|10\\..*|192\\.168\\..*|169\\.254\\..*)")
                        && parsed.getUserInfo() == null;
            } catch (IllegalArgumentException ex) { valid = false; }
            if (title.isBlank() || title.length() > 160 || url.length() > 600 || !valid
                    || title.contains("\n") || url.contains("\n")) {
                throw new BusinessValidationException(Map.of("resources", List.of("Invalid external resource")));
            }
            if (seen.add(url)) result.append("- ").append(title).append(": ").append(url).append("\n");
        }
        return result.toString();
    }

}
