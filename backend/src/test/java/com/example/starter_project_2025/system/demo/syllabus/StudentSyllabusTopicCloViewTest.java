package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
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
class StudentSyllabusTopicCloViewTest {
    @Mock private SyllabusRepository syllabuses;
    @Mock private SyllabusSectionRepository sections;
    @Mock private SyllabusTopicRepository topics;
    @Mock private SyllabusCloRepository clos;
    @Mock private SyllabusMaterialRepository materials;
    @Mock private SyllabusTopicCloLinkRepository topicCloLinks;
    @InjectMocks private StudentSyllabusCatalogService service;

    @Test
    void publishedDetailIncludesOnlyClosFromTheRequestedSyllabus() {
        Syllabus syllabus = syllabus(1L, SyllabusStatus.PUBLISHED, true);
        SyllabusClo ownClo = clo(11L, syllabus, "CLO1");
        Syllabus other = syllabus(2L, SyllabusStatus.PUBLISHED, true);
        SyllabusClo foreignClo = clo(22L, other, "CLO2");

        SyllabusSection section = new SyllabusSection();
        section.setId(31L);
        section.setSyllabus(syllabus);
        section.setTitle("Networks");
        section.setOrderIndex(1);
        SyllabusTopic topic = new SyllabusTopic();
        topic.setId(41L);
        topic.setSection(section);
        topic.setTitle("Network Models");
        topic.setOrderIndex(1);

        when(syllabuses.findById(1L)).thenReturn(Optional.of(syllabus));
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(ownClo));
        when(topicCloLinks.findAllForSyllabus(1L)).thenReturn(List.of(
                link(topic, ownClo), link(topic, foreignClo)));
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(section));
        when(topics.findBySection_IdOrderByOrderIndexAsc(31L)).thenReturn(List.of(topic));
        when(materials.findBySyllabus_IdOrderByIdAsc(1L)).thenReturn(List.of());

        StudentSyllabusCatalogService.Detail detail = service.detail(1L);
        assertEquals(1, detail.clos().size());
        assertEquals("CLO1", detail.clos().get(0).code());
        assertEquals(List.of(11L), detail.sections().get(0).topics().get(0).cloIds());
        verify(topicCloLinks, times(1)).findAllForSyllabus(1L);
    }

    @Test
    void publishedDetailWithNoLinksReturnsAnEmptyArray() {
        Syllabus syllabus = syllabus(1L, SyllabusStatus.PUBLISHED, true);
        SyllabusSection section = new SyllabusSection();
        section.setId(31L);
        section.setSyllabus(syllabus);
        section.setTitle("Networks");
        section.setOrderIndex(1);
        SyllabusTopic topic = new SyllabusTopic();
        topic.setId(41L);
        topic.setSection(section);
        topic.setTitle("Network Models");
        topic.setOrderIndex(1);

        when(syllabuses.findById(1L)).thenReturn(Optional.of(syllabus));
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of());
        when(topicCloLinks.findAllForSyllabus(1L)).thenReturn(List.of());
        when(sections.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of(section));
        when(topics.findBySection_IdOrderByOrderIndexAsc(31L)).thenReturn(List.of(topic));
        when(materials.findBySyllabus_IdOrderByIdAsc(1L)).thenReturn(List.of());

        StudentSyllabusCatalogService.Detail detail = service.detail(1L);
        assertEquals(List.of(), detail.sections().get(0).topics().get(0).cloIds());
    }

    @Test
    void draftAndInactiveSyllabusesNeverExposeTopicLinks() {
        when(syllabuses.findById(1L))
                .thenReturn(Optional.of(syllabus(1L, SyllabusStatus.DRAFT, true)));
        when(syllabuses.findById(2L))
                .thenReturn(Optional.of(syllabus(2L, SyllabusStatus.PUBLISHED, false)));

        assertThrows(ResourceNotFoundException.class, () -> service.detail(1L));
        assertThrows(ResourceNotFoundException.class, () -> service.detail(2L));
        verifyNoInteractions(topicCloLinks, clos, topics, sections, materials);
    }

    private static Syllabus syllabus(Long id, SyllabusStatus status, boolean active) {
        Syllabus result = new Syllabus();
        result.setId(id);
        result.setIsActive(active);
        result.setStatus(status);
        result.setCode("TEST-" + id);
        result.setName("Test Syllabus " + id);
        return result;
    }

    private static SyllabusClo clo(Long id, Syllabus syllabus, String code) {
        SyllabusClo result = new SyllabusClo();
        result.setId(id);
        result.setSyllabus(syllabus);
        result.setCode(code);
        result.setDetails("Understand the fundamentals of networking");
        result.setOrderIndex(1);
        return result;
    }

    private static SyllabusTopicCloLink link(SyllabusTopic topic, SyllabusClo clo) {
        SyllabusTopicCloLink link = new SyllabusTopicCloLink();
        link.setTopic(topic);
        link.setClo(clo);
        return link;
    }
}
