package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
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
class SyllabusTemplateServiceTest {

    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusService syllabusService;
    @Mock SyllabusCloRepository clos;
    @Mock SyllabusSectionRepository sections;
    @Mock SyllabusTopicRepository topics;
    @Mock SyllabusMaterialRepository materials;
    @Mock SyllabusTopicCloLinkRepository coverageLinks;
    @Mock SyllabusMaterialFileService materialFiles;

    @InjectMocks SyllabusTemplateService service;

    @Test
    void copyPreservesNestedDataButCreatesNewDraftAndNewTopicLinks() {
        Syllabus original = new Syllabus();
        original.setId(1L);
        original.setCode("SRC101");
        original.setName("Source Syllabus");
        original.setDescription("Original description");
        original.setStatus(SyllabusStatus.PUBLISHED);
        original.setTeachingMethods("Guided labs");

        Syllabus destination = new Syllabus();
        destination.setId(2L);

        SyllabusSection originalSection = new SyllabusSection();
        originalSection.setId(10L);
        originalSection.setSyllabus(original);
        originalSection.setTitle("Fundamentals");
        originalSection.setMission("Complete a guided lab");
        originalSection.setOrderIndex(1);

        SyllabusTopic originalTopic = new SyllabusTopic();
        originalTopic.setId(100L);
        originalTopic.setSection(originalSection);
        originalTopic.setTitle("Basics");
        originalTopic.setOrderIndex(1);

        SyllabusClo originalClo = new SyllabusClo();
        originalClo.setId(500L);
        originalClo.setCode("CLO1");
        originalClo.setDetails("Explain the fundamentals of this subject");
        originalClo.setOrderIndex(1);

        SyllabusTopicCloLink originalLink = new SyllabusTopicCloLink();
        originalLink.setTopic(originalTopic);
        originalLink.setClo(originalClo);

        SyllabusMaterial originalMaterial = new SyllabusMaterial();
        originalMaterial.setSyllabus(original);
        originalMaterial.setTopic(originalTopic);
        originalMaterial.setTitle("Documentation");
        originalMaterial.setUrl("https://example.org/reference");
        originalMaterial.setType(SyllabusMaterial.MaterialType.LINK);
        originalMaterial.setMainMaterial(true);

        SyllabusModels.Detail created = new SyllabusModels.Detail(
                2L, "COPY101", "Copied Syllabus", "Original description",
                List.of(), true, "DRAFT", 0
        );
        when(syllabuses.findById(1L)).thenReturn(Optional.of(original));
        when(syllabuses.findById(2L)).thenReturn(Optional.of(destination));
        when(syllabusService.create(any())).thenReturn(created);
        when(syllabusService.get(2L)).thenReturn(created);
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(originalClo));
        when(coverageLinks.findAllForSyllabus(1L)).thenReturn(List.of(originalLink));
        when(clos.save(any())).thenAnswer(invocation -> {
            SyllabusClo copied = invocation.getArgument(0);
            copied.setId(600L);
            return copied;
        });
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(originalSection));
        when(topics.findBySection_IdOrderByOrderIndexAsc(10L)).thenReturn(List.of(originalTopic));
        when(materials.findBySyllabus_IdOrderByIdAsc(1L)).thenReturn(List.of(originalMaterial));
        when(materialFiles.copyForTemplate(1L, 2L, "https://example.org/reference"))
                .thenReturn("https://example.org/reference");
        when(sections.saveAndFlush(any())).thenAnswer(invocation -> {
            SyllabusSection value = invocation.getArgument(0);
            value.setId(20L);
            return value;
        });
        when(topics.saveAndFlush(any())).thenAnswer(invocation -> {
            SyllabusTopic value = invocation.getArgument(0);
            value.setId(200L);
            return value;
        });

        SyllabusModels.Detail result = service.copy(
                new SyllabusTemplateService.CopyInput(1L, "COPY101", "Copied Syllabus")
        );

        assertEquals(2L, result.id());
        assertEquals(SyllabusStatus.DRAFT, destination.getStatus());
        assertEquals("Guided labs", destination.getTeachingMethods());

        ArgumentCaptor<SyllabusClo> cloCaptor = ArgumentCaptor.forClass(SyllabusClo.class);
        verify(clos).save(cloCaptor.capture());
        assertSame(destination, cloCaptor.getValue().getSyllabus());
        assertEquals("CLO1", cloCaptor.getValue().getCode());

        ArgumentCaptor<SyllabusMaterial> materialCaptor = ArgumentCaptor.forClass(SyllabusMaterial.class);
        verify(materials).save(materialCaptor.capture());
        assertSame(destination, materialCaptor.getValue().getSyllabus());
        assertEquals(200L, materialCaptor.getValue().getTopic().getId());
        assertNotSame(originalTopic, materialCaptor.getValue().getTopic());
        assertSame(original, originalMaterial.getSyllabus());

        ArgumentCaptor<SyllabusTopicCloLink> linkCaptor =
                ArgumentCaptor.forClass(SyllabusTopicCloLink.class);
        verify(coverageLinks).save(linkCaptor.capture());
        assertEquals(200L, linkCaptor.getValue().getTopic().getId());
        assertEquals(600L, linkCaptor.getValue().getClo().getId());
        assertNotSame(originalClo, linkCaptor.getValue().getClo());
    }

    @Test
    void copyRejectsMissingSourceBeforeCreatingAnything() {
        assertThrows(BusinessValidationException.class, () -> service.copy(
                new SyllabusTemplateService.CopyInput(null, "NEW101", "New Syllabus")
        ));
        verifyNoInteractions(syllabusService, syllabuses, sections, topics, clos, materials, coverageLinks);
    }
}
