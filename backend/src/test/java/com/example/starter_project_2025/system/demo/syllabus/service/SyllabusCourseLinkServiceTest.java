package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.ConflictException;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.course.CourseStatus;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCourseUsageRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SyllabusCourseLinkServiceTest {
    @Mock SyllabusRepository syllabuses;
    @Mock CourseRepository courses;
    @Mock SyllabusCourseUsageRepository usage;
    @InjectMocks SyllabusCourseLinkService links;

    @Test void linkStoresOnlySyllabusForeignKey() {
        Syllabus syllabus = publishedSyllabus(10L);
        Course course = draftCourse(20L);
        when(syllabuses.findById(10L)).thenReturn(Optional.of(syllabus));
        when(courses.findById(20L)).thenReturn(Optional.of(course));

        links.link(10L, 20L);

        assertSame(syllabus, course.getSyllabus());
        verify(courses).save(course);
        verifyNoInteractions(usage);
    }

    @Test void rejectsDraftSyllabusBeforeReadingCourse() {
        Syllabus syllabus = publishedSyllabus(10L);
        syllabus.setStatus(SyllabusStatus.DRAFT);
        when(syllabuses.findById(10L)).thenReturn(Optional.of(syllabus));
        assertThrows(ConflictException.class, () -> links.link(10L, 20L));
        verifyNoInteractions(courses);
    }

    @Test void rejectsReassigningCourseWithoutExplicitUnlink() {
        Syllabus syllabus = publishedSyllabus(10L);
        Course course = draftCourse(20L);
        course.setSyllabus(publishedSyllabus(11L));
        when(syllabuses.findById(10L)).thenReturn(Optional.of(syllabus));
        when(courses.findById(20L)).thenReturn(Optional.of(course));
        assertThrows(ConflictException.class, () -> links.link(10L, 20L));
        assertEquals(11L, course.getSyllabus().getId());
        verify(courses, never()).save(any());
    }

    @Test void linkingSameSyllabusIsIdempotent() {
        Syllabus syllabus = publishedSyllabus(10L);
        Course course = draftCourse(20L);
        course.setSyllabus(syllabus);
        when(syllabuses.findById(10L)).thenReturn(Optional.of(syllabus));
        when(courses.findById(20L)).thenReturn(Optional.of(course));
        links.link(10L, 20L);
        verify(courses, never()).save(any());
    }

    @Test void unlinkDoesNotDeleteCourse() {
        Course course = draftCourse(20L);
        course.setSyllabus(publishedSyllabus(10L));
        when(courses.findById(20L)).thenReturn(Optional.of(course));
        links.unlink(10L, 20L);
        assertNull(course.getSyllabus());
        verify(courses).save(course);
        verify(courses, never()).delete(any(Course.class));
    }

    @Test void publishedCourseCannotBeUnlinked() {
        Course course = draftCourse(20L);
        course.setStatus(CourseStatus.PUBLISHED);
        course.setSyllabus(publishedSyllabus(10L));
        when(courses.findById(20L)).thenReturn(Optional.of(course));
        assertThrows(ConflictException.class, () -> links.unlink(10L, 20L));
        assertNotNull(course.getSyllabus());
        verify(courses, never()).save(any());
    }

    @Test void candidateListContainsOnlyReturnedUnlinkedCourses() {
        Course course = draftCourse(20L);
        course.setName("Intro to Java");
        when(usage.findUnlinkedCourses("java")).thenReturn(List.of(course));
        var candidates = links.availableCourses("java");
        assertEquals(1, candidates.size());
        assertEquals("Intro to Java", candidates.getFirst().name());
        assertEquals("DRAFT", candidates.getFirst().status());
    }

    private static Syllabus publishedSyllabus(Long id) {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(id);
        syllabus.setStatus(SyllabusStatus.PUBLISHED);
        syllabus.setIsActive(true);
        return syllabus;
    }

    private static Course draftCourse(Long id) {
        Course course = new Course();
        course.setId(id);
        course.setStatus(CourseStatus.DRAFT);
        course.setIsActive(true);
        return course;
    }
}
