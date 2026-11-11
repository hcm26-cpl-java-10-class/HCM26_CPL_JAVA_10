package com.example.starter_project_2025.system.demo.course;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.course.CourseFromSyllabusModels.*;
import com.example.starter_project_2025.system.demo.lesson.LessonDTO;
import com.example.starter_project_2025.system.demo.lesson.LessonService;
import com.example.starter_project_2025.system.demo.section.SectionDTO;
import com.example.starter_project_2025.system.demo.section.SectionService;
import com.example.starter_project_2025.system.demo.syllabus.*;
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

@ExtendWith(MockitoExtension.class)
class CourseFromSyllabusServiceTest {
    @Mock CourseService courseService;
    @Mock CourseRepository courses;
    @Mock CourseMapper courseMapper;
    @Mock SectionService sectionService;
    @Mock LessonService lessonService;
    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusSectionRepository sections;
    @Mock SyllabusTopicRepository topics;
    @InjectMocks CourseFromSyllabusService service;

    @Test
    void trimsNamesAndRejectsInvalidPreviewBeforeAnyWrite() {
        List<DraftSection> cleaned = CourseFromSyllabusService.normalizeAndValidateOutline(
                List.of(new DraftSection("  Java   Basics  ", List.of("  Topic   One "))));
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
                List.of(new DraftSection("  Custom Section  ", List.of(" First Lesson ", " Last Lesson ")))));

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
        verify(lessonService, times(2)).create(lessonCaptor.capture());
        assertEquals(List.of("First Lesson", "Last Lesson"),
                lessonCaptor.getAllValues().stream().map(LessonDTO::getTitle).toList());
        assertEquals(List.of(0, 1), lessonCaptor.getAllValues().stream().map(LessonDTO::getOrderIndex).toList());
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
        when(courses.existsByName("Java Fundamentals - Class 01")).thenReturn(true);
        when(courses.existsByName("Java Fundamentals - Class 02")).thenReturn(true);
        when(courses.existsByName("Java Fundamentals - Class 03")).thenReturn(false);

        NameSuggestion suggested = service.suggestName(7L, 1);
        assertEquals("Java Fundamentals - Class 03", suggested.name());
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
}
