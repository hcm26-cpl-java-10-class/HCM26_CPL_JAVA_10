package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.course.Course;
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
class StudentSyllabusRelatedCoursesTest {
    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusCourseUsageRepository courseUsage;
    @InjectMocks StudentSyllabusCatalogService catalog;

    @Test void exposesOnlyCoursesReturnedByPublishedActiveQuery() {
        Syllabus syllabus = syllabus(SyllabusStatus.PUBLISHED, true);
        Course course = new Course();
        course.setId(22L);
        course.setName("Java Essentials");
        when(syllabuses.findById(4L)).thenReturn(Optional.of(syllabus));
        when(courseUsage.findPublishedActiveBySyllabus(4L)).thenReturn(List.of(course));
        var related = catalog.relatedCourses(4L);
        assertEquals(1, related.size());
        assertEquals(22L, related.getFirst().id());
        assertEquals("Java Essentials", related.getFirst().name());
    }

    @Test void draftSyllabusNeverQueriesCourses() {
        when(syllabuses.findById(4L)).thenReturn(Optional.of(syllabus(SyllabusStatus.DRAFT, true)));
        assertThrows(ResourceNotFoundException.class, () -> catalog.relatedCourses(4L));
        verifyNoInteractions(courseUsage);
    }

    @Test void inactiveSyllabusNeverQueriesCourses() {
        when(syllabuses.findById(4L)).thenReturn(Optional.of(syllabus(SyllabusStatus.PUBLISHED, false)));
        assertThrows(ResourceNotFoundException.class, () -> catalog.relatedCourses(4L));
        verifyNoInteractions(courseUsage);
    }

    private static Syllabus syllabus(SyllabusStatus status, boolean active) {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(4L);
        syllabus.setStatus(status);
        syllabus.setIsActive(active);
        return syllabus;
    }
}
