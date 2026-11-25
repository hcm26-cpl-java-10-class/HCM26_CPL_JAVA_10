package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCourseUsageRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.course.Course;
import com.example.starter_project_2025.system.demo.course.CourseStatus;

class SyllabusCourseUsageServiceTest {
    @Test void reportsLinkedCourseIncludingDraftWithoutMatchingNames() {
        var syllabuses = mock(SyllabusRepository.class);
        var usage = mock(SyllabusCourseUsageRepository.class);
        Syllabus syllabus = new Syllabus();
        syllabus.setId(17L);
        syllabus.setCode("JAVA101");
        syllabus.setName("Java Blueprint");
        syllabus.setIsActive(true);
        Course course = new Course();
        course.setId(99L);
        course.setName("Completely Different Course Name");
        course.setSyllabus(syllabus);
        course.setStatus(CourseStatus.DRAFT);
        course.setIsActive(true);
        when(usage.findLinkedCoursesOrderedByName()).thenReturn(List.of(course));
        when(syllabuses.search("")).thenReturn(List.of(syllabus));

        var rows = new SyllabusCourseUsageService(syllabuses, usage).listUsage();

        assertEquals(1, rows.getFirst().courseCount());
        assertEquals(99L, rows.getFirst().courses().getFirst().id());
        assertEquals("DRAFT", rows.getFirst().courses().getFirst().status());
    }

    @Test void includesUnusedSyllabusWithoutInventingCourses() {
        var syllabuses=mock(SyllabusRepository.class);
        var usage=mock(SyllabusCourseUsageRepository.class);
        Syllabus syllabus=new Syllabus(); syllabus.setId(17L);
        syllabus.setCode("DB-101"); syllabus.setName("Database Design"); syllabus.setIsActive(true);
        when(usage.findLinkedCoursesOrderedByName()).thenReturn(List.of());
        when(syllabuses.search("")).thenReturn(List.of(syllabus));
        var result=new SyllabusCourseUsageService(syllabuses,usage).listUsage();
        assertEquals(1,result.size());
        assertEquals(17L,result.getFirst().syllabusId());
        assertEquals(0,result.getFirst().courseCount());
        assertEquals(List.of(),result.getFirst().courses());
        assertEquals("DRAFT",result.getFirst().syllabusStatus());
    }
}
