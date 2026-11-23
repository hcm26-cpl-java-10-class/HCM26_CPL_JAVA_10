package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

/** Regression tests: query extraction must preserve the existing REST DTO shapes. */
class SyllabusQueryServiceTest {
    private SyllabusRepository syllabuses;
    private SyllabusSectionRepository sections;
    private SyllabusTopicRepository topics;
    private SyllabusWorkflowService workflow;
    private SyllabusQueryService queries;

    @BeforeEach
    void setUp() {
        syllabuses = mock(SyllabusRepository.class);
        sections = mock(SyllabusSectionRepository.class);
        topics = mock(SyllabusTopicRepository.class);
        workflow = mock(SyllabusWorkflowService.class);
        queries = new SyllabusQueryService(syllabuses, sections, topics, workflow);
    }

    private Syllabus sampleSyllabus() {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(10L);
        syllabus.setCode("DB-101");
        syllabus.setName("Database Design");
        syllabus.setDescription("Relational databases");
        syllabus.setIsActive(true);
        syllabus.setTeachingMethods("Lecture");
        syllabus.setDegreeLevel("Undergraduate");
        syllabus.setTimeAllocation("12 weeks");
        syllabus.setStudentResponsibilities("Practice SQL");
        syllabus.setRequiredTools("H2");
        syllabus.setScoringScale(10);
        return syllabus;
    }

    private SyllabusWorkflowService.ProgressView progress() {
        return new SyllabusWorkflowService.ProgressView(
                10L, SyllabusStatus.DRAFT, 50, false, List.of(), List.of("Materials"));
    }

    @Test
    void listPreservesSummaryDtoAndNormalizedSearch() {
        when(syllabuses.search("DB design")).thenReturn(List.of(sampleSyllabus()));
        when(sections.countBySyllabus_Id(10L)).thenReturn(2L);
        when(workflow.progress(10L)).thenReturn(progress());

        List<Summary> result = queries.list("  DB   design  ");

        assertEquals(1, result.size());
        assertEquals("DB-101", result.getFirst().code());
        assertEquals(2L, result.getFirst().sectionCount());
        assertEquals(50, result.getFirst().completionPercent());
        assertEquals("DRAFT", result.getFirst().status());
        verify(syllabuses).search("DB design");
        verify(syllabuses, never()).save(any());
    }

    @Test
    void getPreservesNestedSectionAndTopicDto() {
        Syllabus syllabus = sampleSyllabus();
        SyllabusSection section = new SyllabusSection();
        section.setId(20L);
        section.setTitle("Relational Design");
        section.setOrderIndex(1);
        section.setMission("Learn normalization");
        SyllabusTopic topic = new SyllabusTopic();
        topic.setId(30L);
        topic.setTitle("Normal Forms");
        topic.setOrderIndex(1);

        when(syllabuses.findById(10L)).thenReturn(Optional.of(syllabus));
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(section));
        when(topics.findBySection_IdOrderByOrderIndexAsc(20L)).thenReturn(List.of(topic));
        when(workflow.progress(10L)).thenReturn(progress());

        Detail result = queries.get(10L);
        assertEquals("Database Design", result.name());
        assertEquals("Relational Design", result.sections().getFirst().title());
        assertEquals("Learn normalization", result.sections().getFirst().mission());
        assertEquals("Normal Forms", result.sections().getFirst().topics().getFirst().title());
    }

    @Test
    void getInformationPreservesResponseFields() {
        when(syllabuses.findById(10L)).thenReturn(Optional.of(sampleSyllabus()));
        InformationView result = queries.getInformation(10L);
        assertEquals("Lecture", result.teachingMethods());
        assertEquals("Undergraduate", result.degreeLevel());
        assertEquals("H2", result.requiredTools());
        assertEquals(Integer.valueOf(10), result.scoringScale());
    }

    @Test
    void longSearchIsRejectedBeforeQuerying() {
        assertThrows(BusinessValidationException.class, () -> queries.list("x".repeat(101)));
        verifyNoInteractions(syllabuses);
    }

    @Test
    void missingSyllabusKeepsNotFoundBehavior() {
        when(syllabuses.findById(999L)).thenReturn(Optional.empty());
        assertThrows(ResourceNotFoundException.class, () -> queries.get(999L));
    }
}
