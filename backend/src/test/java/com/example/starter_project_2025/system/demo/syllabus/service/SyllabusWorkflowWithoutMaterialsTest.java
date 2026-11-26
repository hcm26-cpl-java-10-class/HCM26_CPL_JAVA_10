package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.course.CourseRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusCloRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SyllabusWorkflowWithoutMaterialsTest {
    @Test
    void allAcademicChecksCompleteWithoutAnyLegacyMaterials() {
        var syllabuses = mock(SyllabusRepository.class);
        var courses = mock(CourseRepository.class);
        var sections = mock(SyllabusSectionRepository.class);
        var topics = mock(SyllabusTopicRepository.class);
        var clos = mock(SyllabusCloRepository.class);
        var service = new SyllabusWorkflowService(syllabuses, courses, sections, topics, clos);
        var syllabus = new Syllabus();
        syllabus.setId(8L);
        syllabus.setStatus(SyllabusStatus.DRAFT);
        syllabus.setDescription("SQL, normalization and database design");
        syllabus.setTeachingMethods("Lab exercises");
        syllabus.setDegreeLevel("Undergraduate");
        syllabus.setTimeAllocation("15 weeks");
        syllabus.setStudentResponsibilities("Practice queries");
        syllabus.setRequiredTools("PostgreSQL");
        syllabus.setScoringScale(10);
        var section = new SyllabusSection();
        section.setId(12L);
        section.setMission("Design and query relational tables");
        when(syllabuses.findById(8L)).thenReturn(Optional.of(syllabus));
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(8L)).thenReturn(List.of(section));
        when(topics.countBySection_Id(12L)).thenReturn(2L);
        when(clos.countBySyllabus_Id(8L)).thenReturn(2L);

        var progress = service.progress(8L);
        assertEquals(5, progress.checks().size());
        assertTrue(progress.checks().stream().noneMatch(c -> "materials".equals(c.key())));
        assertEquals(100, progress.completionPercent());
        assertTrue(progress.canPublish());
        assertTrue(progress.missing().isEmpty());

        when(syllabuses.saveAndFlush(syllabus)).thenReturn(syllabus);
        var published = service.publish(8L);
        assertEquals(SyllabusStatus.PUBLISHED, published.status());
        verify(syllabuses).saveAndFlush(syllabus);
    }
}
