package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BusinessValidationException;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusAiModels.*;
import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels;
import com.example.starter_project_2025.system.demo.syllabus.entity.*;
import com.example.starter_project_2025.system.demo.syllabus.repository.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SyllabusAiServiceTest {
    private AiTextClient ai;
    private SyllabusService syllabuses;
    private SyllabusRepository syllabusRepository;
    private SyllabusCloRepository clos;
    private SyllabusSectionRepository sections;
    private SyllabusTopicRepository topics;
    private SyllabusTopicCloLinkRepository links;
    private SyllabusMaterialRepository materials;
    private SyllabusAiService service;

    @BeforeEach void setup() {
        ai = mock(AiTextClient.class);
        syllabuses = mock(SyllabusService.class);
        syllabusRepository = mock(SyllabusRepository.class);
        clos = mock(SyllabusCloRepository.class);
        sections = mock(SyllabusSectionRepository.class);
        topics = mock(SyllabusTopicRepository.class);
        links = mock(SyllabusTopicCloLinkRepository.class);
        materials = mock(SyllabusMaterialRepository.class);
        service = new SyllabusAiService(ai, new ObjectMapper(), syllabuses,
                syllabusRepository, clos, sections, topics, links, materials);
    }

    private Draft valid() {
        return new Draft("JAV202", "Modern Java Development", "Modern Java course",
                "Project-based learning", "Undergraduate", "45 hours",
                "Complete weekly exercises", "JDK 21", 10,
                List.of("Explain Java object-oriented programming principles",
                        "Apply Java collections to solve programming problems"),
                List.of(new SectionDraft("Object Oriented Java", "Build a basic project",
                        List.of(new TopicDraft("Objects and Classes", List.of(1)),
                                new TopicDraft("Inheritance and Interfaces", List.of(1, 2))))),
                List.of(new MaterialDraft("Official Java documentation", "DOCUMENT", "", "", "",
                        false, "Find the official documentation and verify the URL", null, null, false)));
    }

    @Test void previewValidationAcceptsUnselectedMaterialWithoutUrl() {
        assertDoesNotThrow(() -> SyllabusAiService.validate(valid()));
    }

    @Test void selectedMaterialMustHaveVerifiedUrl() {
        Draft d = valid();
        var chosen = new MaterialDraft("Official Java documentation", "DOCUMENT", "", "", "",
                false, "verify", null, null, true);
        Draft invalid = new Draft(d.code(), d.name(), d.description(), d.teachingMethods(),
                d.degreeLevel(), d.timeAllocation(), d.studentResponsibilities(), d.requiredTools(),
                d.scoringScale(), d.clos(), d.sections(), List.of(chosen));
        assertThrows(BusinessValidationException.class, () -> SyllabusAiService.validate(invalid));
        verifyNoInteractions(syllabuses, syllabusRepository);
    }

    @Test void badCloMappingRejectedBeforeAnyDatabaseWrite() {
        Draft d = valid();
        Draft invalid = new Draft(d.code(), d.name(), d.description(), d.teachingMethods(), d.degreeLevel(),
                d.timeAllocation(), d.studentResponsibilities(), d.requiredTools(), d.scoringScale(), d.clos(),
                List.of(new SectionDraft("Object Oriented Java", "", List.of(
                        new TopicDraft("Interfaces in Java", List.of(99))))), d.materials());
        assertThrows(BusinessValidationException.class, () -> service.save(invalid));
        verifyNoInteractions(syllabuses, syllabusRepository, clos, sections, topics, links, materials);
    }

    @Test void generationReturnsPreviewOnlyAndNeverTrustsAiMaterialUrls() throws Exception {
        String json = """
          {"description":"Modern Java course","teachingMethods":"Project-based learning",
           "timeAllocation":"45 hours","studentResponsibilities":"Weekly exercises","requiredTools":"JDK 21",
           "scoringScale":10,
           "clos":["Explain Java object-oriented programming principles","Apply Java collections to solve programming problems"],
           "sections":[{"title":"Object Oriented Java","mission":"Build a project",
              "topics":[{"title":"Objects and Classes","cloNumbers":[1]}]}],
           "materials":[{"title":"Java manual","type":"BOOK","url":"https://unverified.example/fake",
             "author":"","publisher":"","mainMaterial":true,"note":"Search for this title",
             "sectionIndex":0,"topicIndex":0,"include":true}]}
          """;
        when(ai.generateJson(anyString(), anyList(), anyDouble()))
                .thenReturn(new ObjectMapper().readTree(json));
        GenerateRequest request = new GenerateRequest("JAV202", "Modern Java Development", "OOP", "Undergraduate",
                "English", 2, 1, 2, "");
        Draft result = service.generate(request);
        assertEquals("JAV202", result.code());
        assertEquals("Modern Java Development", result.name());
        assertFalse(result.materials().get(0).include());
        assertEquals("", result.materials().get(0).url());
        assertNull(result.materials().get(0).sectionIndex());
        verifyNoInteractions(syllabuses, syllabusRepository, clos, sections, topics, links, materials);
    }

    @Test void vietnameseInstructionsStillRequestEnglishSyllabusOutput() throws Exception {
        String json = """
          {"name":"Introduction to Spring Framework","description":"Introduction to Spring Framework principles",
           "teachingMethods":"Project-based learning","timeAllocation":"45 hours",
           "studentResponsibilities":"Complete programming exercises","requiredTools":"JDK 21",
           "clos":["Explain inversion of control and dependency injection",
                   "Develop web services with Spring Boot"],
           "sections":[{"title":"Spring Framework Fundamentals","mission":"Build a basic Spring project",
              "topics":[{"title":"Spring Core Concepts","cloNumbers":[1,2]}]}],
           "materials":[]}
          """;
        when(ai.generateJson(anyString(), anyList(), anyDouble()))
                .thenReturn(new ObjectMapper().readTree(json));
        GenerateRequest request = new GenerateRequest("HSF302", "Giới thiệu Spring Framework",
                "Lập trình web với Spring", "Undergraduate", "Vietnamese", 2, 1, 2,
                "Hãy tạo phần giảng dạy cơ bản cho sinh viên");
        Draft result = service.generate(request);
        assertEquals("Introduction to Spring Framework", result.name());
        var systemPrompt = org.mockito.ArgumentCaptor.forClass(String.class);
        @SuppressWarnings("unchecked")
        var turns = org.mockito.ArgumentCaptor.forClass(List.class);
        verify(ai).generateJson(systemPrompt.capture(), turns.capture(), anyDouble());
        assertTrue(systemPrompt.getValue().contains("ALL generated academic content in ENGLISH"));
        assertTrue(turns.getValue().toString().contains("REQUIRED OUTPUT LANGUAGE: English"));
        assertEquals("Undergraduate", result.degreeLevel());
        verifyNoInteractions(syllabuses, syllabusRepository, clos, sections, topics, links, materials);
    }

    @Test void nonEnglishGeneratedTitleIsNotPresentedAsAnEnglishPreview() throws Exception {
        String json = """
          {"name":"Giới thiệu Spring Framework","description":"Introduction to Spring Framework",
           "teachingMethods":"Project-based learning","timeAllocation":"45 hours",
           "studentResponsibilities":"Complete programming exercises","requiredTools":"JDK 21",
           "clos":["Explain inversion of control and dependency injection",
                   "Develop web services with Spring Boot"],
           "sections":[{"title":"Spring Fundamentals","mission":"Build a basic application",
              "topics":[{"title":"Spring Core","cloNumbers":[1,2]}]}],"materials":[]}
          """;
        when(ai.generateJson(anyString(), anyList(), anyDouble()))
                .thenReturn(new ObjectMapper().readTree(json));
        assertThrows(com.example.starter_project_2025.exception.BadRequestException.class,
                () -> service.generate(new GenerateRequest("HSF302", "Giới thiệu Spring Framework", "",
                        "Undergraduate", "Vietnamese", 2, 1, 2, "")));
        verifyNoInteractions(syllabuses, syllabusRepository, clos, sections, topics, links, materials);
    }

    @Test void unknownTeachingLanguageIsRejectedBeforeCallingAi() {
        assertThrows(BusinessValidationException.class, () -> service.generate(
                new GenerateRequest("HSF302", "Spring Framework", "", "Undergraduate",
                        "Other", 2, 1, 2, "")));
        verifyNoInteractions(ai);
    }

    @Test void generationRejectsOutOfRangeInputBeforeCallingAi() {
        assertThrows(BusinessValidationException.class, () -> service.generate(
                new GenerateRequest("JAV202", "Modern Java Development", "", "", "English", 40, 2, 3, "")));
        verifyNoInteractions(ai);
    }

    @Test void reviewedSavePersistsTopicCloLinksAndOnlySelectedMaterials() {
        Draft d = valid();
        var selected = new MaterialDraft("Official Java documentation", "DOCUMENT", "https://docs.oracle.com/en/java/",
                "Oracle", "Oracle", true, "Verified official docs", 0, 1, true);
        Draft reviewed = new Draft(d.code(), d.name(), d.description(), d.teachingMethods(),
                d.degreeLevel(), d.timeAllocation(), d.studentResponsibilities(), d.requiredTools(),
                d.scoringScale(), d.clos(), d.sections(), List.of(d.materials().get(0), selected));

        when(syllabuses.create(any())).thenReturn(new SyllabusModels.Detail(44L, d.code(), d.name(),
                d.description(), List.of(), true, "DRAFT", 0));
        Syllabus syllabus = new Syllabus(); syllabus.setId(44L);
        when(syllabusRepository.findById(44L)).thenReturn(Optional.of(syllabus));
        AtomicLong ids = new AtomicLong(100);
        when(clos.save(any())).thenAnswer(invocation -> {
            SyllabusClo c = invocation.getArgument(0); c.setId(ids.getAndIncrement()); return c;
        });
        when(sections.saveAndFlush(any())).thenAnswer(invocation -> {
            SyllabusSection section = invocation.getArgument(0);
            section.setId(ids.getAndIncrement()); return section;
        });
        when(topics.saveAndFlush(any())).thenAnswer(invocation -> {
            SyllabusTopic topic = invocation.getArgument(0);
            topic.setId(ids.getAndIncrement()); return topic;
        });

        SaveResult result = service.save(reviewed);
        assertEquals(Long.valueOf(44L), result.id());
        assertEquals(1, result.savedMaterialCount());
        verify(clos, times(2)).save(any());
        verify(sections).saveAndFlush(any());
        verify(topics, times(2)).saveAndFlush(any());
        verify(links, times(3)).save(any());
        var materialCapture = org.mockito.ArgumentCaptor.forClass(SyllabusMaterial.class);
        verify(materials).save(materialCapture.capture());
        assertEquals("https://docs.oracle.com/en/java/", materialCapture.getValue().getUrl());
        assertEquals("Inheritance and Interfaces", materialCapture.getValue().getTopic().getTitle());
        verify(syllabuses).updateInformation(eq(44L), any());
    }

}
