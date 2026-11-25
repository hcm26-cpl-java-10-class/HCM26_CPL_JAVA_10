package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
import com.example.starter_project_2025.system.demo.lesson.LessonDTO;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.lesson.LessonService;
import com.example.starter_project_2025.system.demo.section.SectionDTO;
import com.example.starter_project_2025.system.demo.section.SectionService;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

@ExtendWith(MockitoExtension.class)
class CourseFromSyllabusServiceTest {
    @Mock CourseService courseService;
    @Mock CourseRepository courses;
    @Mock CourseMapper courseMapper;
    @Mock SectionService sectionService;
    @Mock SectionRepository courseSections;
    @Mock LessonService lessonService;
    @Mock LessonRepository lessonRepository;
    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusSectionRepository sections;
    @Mock SyllabusTopicRepository topics;
    @Mock com.example.starter_project_2025.system.exam.service.ExamServiceImpl examService;
    @Mock jakarta.validation.Validator validator;
    @InjectMocks CourseFromSyllabusService service;

    private static com.example.starter_project_2025.system.exam.dto.ExamDTO quizConfig() {
        var config = new com.example.starter_project_2025.system.exam.dto.ExamDTO();
        config.setTitle("Quiz heading");
        config.setDurationMinutes(15);
        config.setCategory(com.example.starter_project_2025.system.exam.domain.ExamCategory.QUIZ);
        config.setExamType(com.example.starter_project_2025.system.exam.domain.ExamType.MULTIPLE_CHOICE);
        return config;
    }

    private static DraftSection assessmentOutline(com.example.starter_project_2025.system.exam.dto.ExamDTO config) {
        return new DraftSection("Database Basics", List.of("Quiz heading"), null,
                List.of("Read the instructions before starting."), List.of(LessonContentType.QUIZ),
                List.of(""), List.of(0), List.of(config));
    }

    @Test
    void configuredAssessmentUsesMinutesAndRejectsForeignIdsWrongCategoryAndQuestions() {
        var config = quizConfig();
        var normalized = CourseFromSyllabusService.normalizeAndValidateOutline(List.of(assessmentOutline(config))).getFirst();
        assertEquals(List.of(900), normalized.lessonDurations());
        assertEquals(List.of("Read the instructions before starting."), normalized.lessonMaterials());
        config.setDurationMinutes(-9);
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(assessmentOutline(config))));
        config.setDurationMinutes(15);
        config.setQuestionIds(List.of(99L));
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(assessmentOutline(config))));
        config.setQuestionIds(null);
        config.setCategory(com.example.starter_project_2025.system.exam.domain.ExamCategory.ASSIGNMENT);
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(assessmentOutline(config))));
        config.setCategory(com.example.starter_project_2025.system.exam.domain.ExamCategory.QUIZ);
        config.setLessonId(123L);
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(assessmentOutline(config))));
        verifyNoInteractions(courseService, lessonService, examService);
    }

    @Test
    void configuredAssessmentRequiresPermissionAndUsesNativeServiceWithRealIds() {
        var context = org.springframework.security.core.context.SecurityContextHolder.createEmptyContext();
        var previous = org.springframework.security.core.context.SecurityContextHolder.getContext();
        org.springframework.security.core.context.SecurityContextHolder.setContext(context);
        try {
            Syllabus syllabus = new Syllabus();
            syllabus.setId(7L); syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
            when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
            var request = new CreateRequest(CourseDTO.builder().syllabusId(7L).name("Database Course").build(), List.of(assessmentOutline(quizConfig())));
            assertThrows(org.springframework.security.access.AccessDeniedException.class, () -> service.createCustomized(request));
            verifyNoInteractions(courseService, lessonService, examService);
            context.setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken("teacher", "", List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("EXAM_CREATE"))));
            when(validator.validate(any(com.example.starter_project_2025.system.exam.dto.ExamDTO.class), eq(com.example.starter_project_2025.base.crud.dto.OnCreate.class))).thenReturn(java.util.Set.of());
            var created = CourseDTO.builder().build(); created.setId(11L);
            var course = new Course(); course.setId(11L);
            when(courseService.create(any())).thenReturn(created);
            when(courses.findById(11L)).thenReturn(Optional.of(course));
            when(courseMapper.toResponse(course)).thenReturn(created);
            var section = SectionDTO.builder().build(); section.setId(22L);
            when(sectionService.create(any())).thenReturn(section);
            var lesson = new LessonDTO(); lesson.setId(33L);
            when(lessonService.create(any())).thenReturn(lesson);
            assertSame(created, service.createCustomized(request));
            var captor = ArgumentCaptor.forClass(com.example.starter_project_2025.system.exam.dto.ExamDTO.class);
            verify(examService).create(captor.capture());
            assertEquals(11L, captor.getValue().getCourseId());
            assertEquals(22L, captor.getValue().getSectionId());
            assertEquals(33L, captor.getValue().getLessonId());
            assertNull(captor.getValue().getQuestionIds());
        } finally { org.springframework.security.core.context.SecurityContextHolder.setContext(previous); }
    }

    @Test
    void trimsNamesAndRejectsInvalidPreviewBeforeAnyWrite() {
        List<DraftSection> cleaned = CourseFromSyllabusService.normalizeAndValidateOutline(
                List.of(new DraftSection("  Java   Basics  ", List.of("  Topic   One "), null, List.of("## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result."))));
        assertEquals("Java Basics", cleaned.getFirst().title());
        assertEquals("Topic One", cleaned.getFirst().lessons().getFirst());
        assertThrows(BusinessValidationException.class, () ->
                CourseFromSyllabusService.normalizeAndValidateOutline(
                        List.of(new DraftSection("Java Basics", List.of("One")),
                                new DraftSection(" java basics ", List.of("Two")))));
        assertThrows(BusinessValidationException.class, () ->
                CourseFromSyllabusService.normalizeAndValidateOutline(
                        List.of(new DraftSection("Java Basics", List.of()))));
        verifyNoInteractions(courseService, sectionService, lessonService);
    }


    @Test
    void rejectsCourseWithoutLessonMaterialBeforeAnyDatabaseWrites() {
        assertThrows(BusinessValidationException.class, () ->
                CourseFromSyllabusService.normalizeAndValidateOutline(List.of(
                        new DraftSection("Course Section", List.of("Important Lesson"),
                                List.of(30L), List.of("")))));
        verifyNoInteractions(courseService, sectionService, lessonService);
    }

    @Test
    void validatesNativeMediaTypesAndAllowsOnlyBlankOrSafeDraftUrls() {
        String notes = "## Learning notes\nThese instructions describe the topic with practical examples, "
                + "a guided activity, expected learner results and a detailed self-check.";
        DraftSection withMedia = new DraftSection("Mixed Media", List.of("Audio lesson", "Video lesson"),
                List.of(101L, 102L), List.of(notes, notes),
                List.of(LessonContentType.AUDIO, LessonContentType.VIDEO),
                List.of("https://example.org/music.mp3", "https://example.org/video.mp4"), List.of(180, 240));
        var normalized = CourseFromSyllabusService.normalizeAndValidateOutline(List.of(withMedia));
        assertEquals(List.of(LessonContentType.AUDIO, LessonContentType.VIDEO), normalized.getFirst().lessonTypes());
        assertEquals(List.of(180, 240), normalized.getFirst().lessonDurations());
        assertEquals(List.of(""), CourseFromSyllabusService.normalizeAndValidateOutline(List.of(
                        new DraftSection("Planned audio", List.of("Audio Lesson"), List.of(101L),
                                List.of(notes), List.of(LessonContentType.AUDIO), List.of(""), List.of(480)))).getFirst().lessonUrls());
        assertThrows(BusinessValidationException.class, () ->
                CourseFromSyllabusService.normalizeAndValidateOutline(List.of(
                        new DraftSection("Unsafe URL", List.of("Video Lesson"), List.of(101L),
                                List.of(notes), List.of(LessonContentType.VIDEO), List.of("javascript:alert(1)"), List.of(0)))));
    }

    @Test
    void allowsAssessmentHeadingsAndUrlOnlyResourcesWithoutTextMaterial() {
        var types = List.of(LessonContentType.QUIZ, LessonContentType.EXAM, LessonContentType.ASSIGNMENT,
                LessonContentType.VIDEO, LessonContentType.AUDIO, LessonContentType.DOCUMENT, LessonContentType.LINK);
        var input = new DraftSection("Mixed Lessons", List.of("Quiz", "Exam", "Assignment", "Video", "Audio", "Document", "Link"),
                null, null, types, List.of("", "", "", "https://example.org/v", "https://example.org/a", "https://example.org/d", "https://example.org/l"), null);
        var normalized = CourseFromSyllabusService.normalizeAndValidateOutline(List.of(input)).getFirst();
        assertEquals(types, normalized.lessonTypes());
        assertEquals(java.util.Collections.nCopies(7, ""), normalized.lessonMaterials());
        assertEquals(input.lessonUrls(), normalized.lessonUrls());
        var staleAssessment = new DraftSection("Assessment", List.of("Quiz"), List.of(30L),
                List.of("Old Text content"), List.of(LessonContentType.QUIZ), List.of("https://example.org/old"), List.of(0));
        var heading = CourseFromSyllabusService.normalizeAndValidateOutline(List.of(staleAssessment)).getFirst();
        assertEquals(List.of(""), heading.lessonMaterials());
        assertEquals(List.of(""), heading.lessonUrls());
        assertEquals(List.of(30L), heading.sourceTopicIds());
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(
                new DraftSection("Invalid", List.of("Quiz"), null, null, List.of(LessonContentType.QUIZ), null, List.of(-1)))));
        assertThrows(BusinessValidationException.class, () -> CourseFromSyllabusService.normalizeAndValidateOutline(List.of(
                new DraftSection("Invalid", List.of("Quiz"), null, List.of("", ""), List.of(LessonContentType.QUIZ), null, null))));
    }

    @Test
    void customizedCreationPersistsExactlyTheEditedOutlineAsDraft() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        CourseDTO input = CourseDTO.builder().syllabusId(7L).name("  Java - 2026  ").build();
        CourseDTO created = CourseDTO.builder().build();
        created.setId(11L);
        when(courseService.create(any())).thenReturn(created);
        Course savedCourse = new Course();
        savedCourse.setId(11L);
        when(courses.findById(11L)).thenReturn(Optional.of(savedCourse));
        when(courseMapper.toResponse(savedCourse)).thenReturn(created);
        SectionDTO savedSection = SectionDTO.builder().build();
        savedSection.setId(22L);
        when(sectionService.create(any())).thenReturn(savedSection);

        CourseDTO result = service.createCustomized(new CreateRequest(input,
                List.of(new DraftSection("  Custom Section  ", List.of(" First Lesson ", " Last Lesson ", "Quiz heading", "Exam heading", "Assignment heading"), null, List.of("## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result.", "## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result.", "stale quiz text", "", ""),
                        List.of(LessonContentType.TEXT, LessonContentType.VIDEO, LessonContentType.QUIZ, LessonContentType.EXAM, LessonContentType.ASSIGNMENT),
                        List.of("", "https://example.org/lesson.mp4", "", "", ""), List.of(0, 240, 0, 0, 0)))));

        assertSame(created, result);
        assertEquals(CourseStatus.DRAFT, input.getStatus());
        assertEquals(Boolean.TRUE, input.getIsActive());
        assertEquals("Java - 2026", input.getName());
        assertEquals(CourseType.FROM_SYLLABUS, savedCourse.getCourseType());
        ArgumentCaptor<SectionDTO> sectionCaptor = ArgumentCaptor.forClass(SectionDTO.class);
        verify(sectionService).create(sectionCaptor.capture());
        assertEquals("Custom Section", sectionCaptor.getValue().getTitle());
        assertEquals(0, sectionCaptor.getValue().getOrderIndex());
        ArgumentCaptor<LessonDTO> lessonCaptor = ArgumentCaptor.forClass(LessonDTO.class);
        verify(lessonService, times(5)).create(lessonCaptor.capture());
        assertEquals(List.of("First Lesson", "Last Lesson", "Quiz heading", "Exam heading", "Assignment heading"),
                lessonCaptor.getAllValues().stream().map(LessonDTO::getTitle).toList());
        assertEquals(List.of(0, 1, 2, 3, 4), lessonCaptor.getAllValues().stream().map(LessonDTO::getOrderIndex).toList());
        assertTrue(lessonCaptor.getAllValues().subList(0, 2).stream().allMatch(l -> l.getTextContent().contains("Lesson notes")));
        assertEquals(List.of(LessonContentType.QUIZ, LessonContentType.EXAM, LessonContentType.ASSIGNMENT),
                lessonCaptor.getAllValues().subList(2, 5).stream().map(LessonDTO::getContentType).toList());
        assertTrue(lessonCaptor.getAllValues().subList(2, 5).stream().allMatch(l -> l.getTextContent() == null && l.getContentUrl() == null));
        assertEquals(LessonContentType.VIDEO, lessonCaptor.getAllValues().get(1).getContentType());
        assertEquals("https://example.org/lesson.mp4", lessonCaptor.getAllValues().get(1).getContentUrl());
        assertEquals(240, lessonCaptor.getAllValues().get(1).getDuration());
    }

    @Test
    void previewFiltersInactiveSectionsAndTopics() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(7L);
        syllabus.setCode("SYL-JAVA");
        syllabus.setName("Java");
        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));

        SyllabusSection active = new SyllabusSection();
        active.setId(20L);
        active.setTitle("Active Section");
        active.setMission("Mission");
        active.setIsActive(true);
        SyllabusSection inactive = new SyllabusSection();
        inactive.setId(21L);
        inactive.setIsActive(false);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(active, inactive));

        SyllabusTopic visible = new SyllabusTopic();
        visible.setId(30L);
        visible.setTitle("Topic visible");
        visible.setIsActive(true);
        SyllabusTopic hidden = new SyllabusTopic();
        hidden.setId(31L);
        hidden.setTitle("Topic hidden");
        hidden.setIsActive(false);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(visible, hidden));

        Preview preview = service.preview(7L);
        assertEquals(1, preview.sections().size());
        assertEquals("Mission", preview.sections().getFirst().mission());
        assertEquals(List.of("Topic visible"), preview.sections().getFirst().topics().stream()
                .map(SourceTopic::title).toList());
        verify(topics, never()).findBySection_IdOrderByOrderIndexAsc(21L);
    }

    @Test
    void suggestionSkipsExistingCourseNamesAndKeepsSourceUnchanged() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(7L);
        syllabus.setName("Java Fundamentals");
        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        when(courses.existsByName("Java Fundamentals - Course 01")).thenReturn(true);
        when(courses.existsByName("Java Fundamentals - Course 02")).thenReturn(true);
        when(courses.existsByName("Java Fundamentals - Course 03")).thenReturn(false);

        NameSuggestion suggested = service.suggestName(7L, 1);
        assertEquals("Java Fundamentals - Course 03", suggested.name());
        assertEquals(3, suggested.sequence());
        assertEquals("Java Fundamentals", syllabus.getName());
        verifyNoInteractions(courseService, sectionService, lessonService);
    }

    @Test
    void nameAvailabilityChecksExistingNames() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        when(courses.existsByName("Java - Class 01")).thenReturn(true);
        assertFalse(service.nameAvailability(7L, " Java - Class 01 ").available());
        assertTrue(service.nameAvailability(7L, "Java - Class 02").available());
    }

    @Test
    void nonPublishedSyllabusCannotBeUsed() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.DRAFT);
        syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        assertThrows(BusinessValidationException.class, () -> service.createCustomized(
                new CreateRequest(CourseDTO.builder().syllabusId(7L).name("New Course").build(),
                        List.of(new DraftSection("Section One", List.of("Lesson One"))))));
        verifyNoInteractions(courseService, sectionService, lessonService);
    }

    @Test
    void sameScopeIsDetectedNoMatterTopicOrder() {
        Syllabus syllabus = new Syllabus(); syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        SyllabusSection section = new SyllabusSection(); section.setId(20L); section.setIsActive(true);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(section));
        SyllabusTopic one = new SyllabusTopic(); one.setId(30L); one.setIsActive(true);
        SyllabusTopic two = new SyllabusTopic(); two.setId(31L); two.setIsActive(true);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(one, two));
        Course previous = new Course(); previous.setId(44L); previous.setName("Old Manual Course");
        previous.setSourceTopicIds("30,31");
        when(courses.findBySyllabus_Id(7L)).thenReturn(List.of(previous));
        ScopeCheck result = service.checkScope(7L, List.of(31L, 30L));
        assertFalse(result.duplicate());
        assertEquals(1L, result.sameScopeCourseCount());
        assertEquals(44L, result.existingCourseId());
        verifyNoInteractions(courseService, lessonService);
    }

    @Test
    void cannotDeleteOrForgeSelectedSourceTopicMapping() {
        Syllabus syllabus = new Syllabus(); syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        SyllabusSection section = new SyllabusSection(); section.setId(20L); section.setIsActive(true);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(section));
        SyllabusTopic topic = new SyllabusTopic(); topic.setId(30L); topic.setIsActive(true);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(topic));
        CourseDTO input = CourseDTO.builder().syllabusId(7L).name("New Course").build();
        assertThrows(BusinessValidationException.class, () -> service.createCustomized(new CreateRequest(input,
                List.of(new DraftSection("Section One", List.of("Manual Lesson"), java.util.Arrays.asList((Long) null))),
                List.of(30L))));
        verifyNoInteractions(courseService, lessonService);
    }

    @Test
    void differentLessonNameStillStoresStableSourceTopicId() {
        Syllabus syllabus = new Syllabus(); syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        SyllabusSection section = new SyllabusSection(); section.setId(20L); section.setIsActive(true);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(section));
        SyllabusTopic topic = new SyllabusTopic(); topic.setId(30L); topic.setIsActive(true);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(topic));
        CourseDTO input = CourseDTO.builder().syllabusId(7L).name("AI Course").build();
        CourseDTO created = CourseDTO.builder().build(); created.setId(11L);
        when(courseService.create(any())).thenReturn(created);
        Course course = new Course(); course.setId(11L);
        when(courses.findById(11L)).thenReturn(Optional.of(course));
        when(courseMapper.toResponse(course)).thenReturn(created);
        SectionDTO savedSection = SectionDTO.builder().build(); savedSection.setId(22L);
        when(sectionService.create(any())).thenReturn(savedSection);
        LessonDTO savedLesson = LessonDTO.builder().build(); savedLesson.setId(60L);
        when(lessonService.create(any())).thenReturn(savedLesson);
        Lesson storedLesson = new Lesson(); storedLesson.setId(60L);
        when(lessonRepository.findById(60L)).thenReturn(Optional.of(storedLesson));
        service.createCustomized(new CreateRequest(input,
                List.of(new DraftSection("AI Section", List.of("Renamed by Gemini"), List.of(30L), List.of("## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result."))),
                List.of(30L)));
        assertEquals(30L, storedLesson.getSourceSyllabusTopicId());
        assertEquals(CourseSourceScope.outlineKey(List.of(30L), List.of(
                new DraftSection("AI Section", List.of("Renamed by Gemini"), List.of(30L)))),
                course.getSourceTopicScopeKey());
        verify(lessonRepository).save(storedLesson);
    }


    @Test
    void recognizesExactMatchingLegacyOutlineAsDuplicateButNeverGuesses() {
        Syllabus syllabus = new Syllabus(); syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        SyllabusSection section = new SyllabusSection(); section.setId(20L); section.setTitle("SQL"); section.setIsActive(true);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(section));
        SyllabusTopic topic = new SyllabusTopic(); topic.setId(30L); topic.setTitle("SELECT"); topic.setIsActive(true);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(topic));
        Course oldCourse = new Course(); oldCourse.setId(12L); oldCourse.setName("Old Course");
        when(courses.findBySyllabus_Id(7L)).thenReturn(List.of(oldCourse));
        Section oldSection = new Section(); oldSection.setId(13L); oldSection.setTitle(" SQL ");
        when(courseSections.findByCourse_IdOrderByOrderIndexAsc(12L)).thenReturn(List.of(oldSection));
        Lesson oldLesson = new Lesson(); oldLesson.setTitle(" select ");
        when(lessonRepository.findBySection_IdOrderByOrderIndexAsc(13L)).thenReturn(List.of(oldLesson));
        ScopeCheck check = service.checkScope(7L, List.of(30L));
        assertFalse(check.duplicate());
        assertEquals(1L, check.sameScopeCourseCount());
        assertEquals(12L, check.existingCourseId());
    }

    @Test
    void oneTopicCanMapToTwoLessonsPlusSupplementaryLesson() {
        Syllabus syllabus = new Syllabus(); syllabus.setId(7L);
        syllabus.setStatus(SyllabusStatus.PUBLISHED); syllabus.setIsActive(true);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        SyllabusSection section = new SyllabusSection(); section.setId(20L); section.setIsActive(true);
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of(section));
        SyllabusTopic topic = new SyllabusTopic(); topic.setId(30L); topic.setIsActive(true);
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(topic));
        CourseDTO input = CourseDTO.builder().syllabusId(7L).name("Expanded Course").build();
        CourseDTO created = CourseDTO.builder().build(); created.setId(11L);
        when(courseService.create(any())).thenReturn(created);
        Course course = new Course(); course.setId(11L);
        when(courses.findById(11L)).thenReturn(Optional.of(course));
        when(courseMapper.toResponse(course)).thenReturn(created);
        SectionDTO savedSection = SectionDTO.builder().build(); savedSection.setId(22L);
        when(sectionService.create(any())).thenReturn(savedSection);
        final int[] nextId = {60};
        when(lessonService.create(any())).thenAnswer(inv -> {
            LessonDTO lesson = LessonDTO.builder().build(); lesson.setId((long) nextId[0]++); return lesson;
        });
        Lesson first = new Lesson(), second = new Lesson();
        when(lessonRepository.findById(60L)).thenReturn(Optional.of(first));
        when(lessonRepository.findById(61L)).thenReturn(Optional.of(second));
        service.createCustomized(new CreateRequest(input, List.of(new DraftSection("Database Basics",
                List.of("Entity Types", "Relationships", "Practice Exercise"),
                java.util.Arrays.asList(30L, 30L, null), List.of("## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result.", "## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result.", "## Lesson notes\nThis material explains key concepts and provides a concrete example that a learner can study.\nPractice: apply the concepts to a small scenario and check the expected result."))), List.of(30L)));
        assertEquals(30L, first.getSourceSyllabusTopicId());
        assertEquals(30L, second.getSourceSyllabusTopicId());
        verify(lessonRepository, times(2)).save(any());
    }

}
