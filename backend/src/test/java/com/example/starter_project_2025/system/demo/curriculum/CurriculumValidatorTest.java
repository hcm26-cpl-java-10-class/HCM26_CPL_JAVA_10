package com.example.starter_project_2025.system.demo.curriculum;

import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.lesson.Lesson;
import com.example.starter_project_2025.system.demo.lesson.LessonContentType;
import com.example.starter_project_2025.system.demo.lesson.LessonRepository;
import com.example.starter_project_2025.system.demo.section.Section;
import com.example.starter_project_2025.system.demo.section.SectionRepository;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class CurriculumValidatorTest {

    private final SectionRepository sectionRepository = mock(SectionRepository.class);
    private final LessonRepository lessonRepository = mock(LessonRepository.class);
    private final CurriculumValidator validator = new CurriculumValidator(sectionRepository, lessonRepository);

    @Test
    void rejectsCourseWithoutSections() {
        when(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of());

        assertEquals(List.of("NO_SECTION"), issueCodes(validator.validatePublish(10L)));
    }

    @Test
    void rejectsSectionWithoutLessons() {
        Section section = section();
        when(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(section));
        when(lessonRepository.findActiveByCourseIdOrdered(10L)).thenReturn(List.of());

        assertEquals(List.of("SECTION_EMPTY"), issueCodes(validator.validatePublish(10L)));
    }

    @Test
    void rejectsLessonWithoutContentType() {
        assertLessonIssue(Lesson.builder().contentType(null).build(), "LESSON_CONTENT_TYPE_MISSING");
    }

    @Test
    void rejectsVideoLessonWithoutUrl() {
        assertLessonIssue(Lesson.builder().contentType(LessonContentType.VIDEO).contentUrl(" ").build(),
                "LESSON_URL_MISSING");
    }

    @Test
    void rejectsVideoLessonWithInvalidUrl() {
        assertLessonIssue(Lesson.builder().contentType(LessonContentType.VIDEO).contentUrl("file:///video.mp4").build(),
                "LESSON_URL_INVALID");
    }

    @Test
    void rejectsTextLessonWithoutContent() {
        assertLessonIssue(Lesson.builder().contentType(LessonContentType.TEXT).textContent(" ").build(),
                "LESSON_TEXT_MISSING");
    }

    @Test
    void acceptsLessonWithValidContent() {
        Section section = section();
        Lesson lesson = Lesson.builder()
                .id(30L)
                .section(section)
                .contentType(LessonContentType.VIDEO)
                .contentUrl("https://example.com/video.mp4")
                .build();
        when(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(section));
        when(lessonRepository.findActiveByCourseIdOrdered(10L)).thenReturn(List.of(lesson));

        assertTrue(validator.validatePublish(10L).valid());
    }

    private void assertLessonIssue(Lesson lesson, String expectedCode) {
        Section section = section();
        lesson.setSection(section);
        when(sectionRepository.findByCourse_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(section));
        when(lessonRepository.findActiveByCourseIdOrdered(10L)).thenReturn(List.of(lesson));

        assertEquals(List.of(expectedCode), issueCodes(validator.validatePublish(10L)));
    }

    private static Section section() {
        return Section.builder()
                .id(20L)
                .course(Course.builder().id(10L).build())
                .title("Introduction")
                .orderIndex(0)
                .build();
    }

    private static List<String> issueCodes(CurriculumValidationResult result) {
        return result.errors().stream().map(CurriculumValidationResult.Issue::code).toList();
    }
}
