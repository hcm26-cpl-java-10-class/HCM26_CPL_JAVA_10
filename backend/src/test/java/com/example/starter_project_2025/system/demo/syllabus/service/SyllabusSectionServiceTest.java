package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

class SyllabusSectionServiceTest {
    @Test void bulkRejectsDuplicateBeforeAnySave() {
        var syllabuses=mock(SyllabusRepository.class);
        var sections=mock(SyllabusSectionRepository.class);
        var topics=mock(SyllabusTopicRepository.class);
        var workflow=mock(SyllabusWorkflowService.class);
        var queries=mock(SyllabusQueryService.class);
        Syllabus syllabus=new Syllabus(); syllabus.setId(7L);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of());
        var service=new SyllabusSectionService(syllabuses, sections, topics, workflow, queries);
        assertThrows(BusinessValidationException.class,
            () -> service.bulkCreateSections(7L,new BulkSectionInput(List.of("Intro to SQL", "intro TO sql"))));
        verify(sections,never()).save(any());
    }
    @Test void singleSectionPreservesMissionAndCallsQueryAfterSave() {
        var syllabuses=mock(SyllabusRepository.class);
        var sections=mock(SyllabusSectionRepository.class);
        var topics=mock(SyllabusTopicRepository.class);
        var workflow=mock(SyllabusWorkflowService.class);
        var queries=mock(SyllabusQueryService.class);
        Syllabus syllabus=new Syllabus(); syllabus.setId(7L);
        when(syllabuses.findById(7L)).thenReturn(Optional.of(syllabus));
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(7L)).thenReturn(List.of());
        var service=new SyllabusSectionService(syllabuses, sections, topics, workflow, queries);
        service.createSection(7L,new SectionInput("Relational Database",1,"  Model tables  "));
        var capture=org.mockito.ArgumentCaptor.forClass(SyllabusSection.class);
        verify(sections).save(capture.capture());
        assertEquals("Model tables",capture.getValue().getMission());
        assertEquals(7L,capture.getValue().getSyllabus().getId());
        verify(queries).get(7L);
    }
}
