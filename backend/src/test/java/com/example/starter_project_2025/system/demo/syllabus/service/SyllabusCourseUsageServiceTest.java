package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCourseUsageRepository;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;

class SyllabusCourseUsageServiceTest {
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
