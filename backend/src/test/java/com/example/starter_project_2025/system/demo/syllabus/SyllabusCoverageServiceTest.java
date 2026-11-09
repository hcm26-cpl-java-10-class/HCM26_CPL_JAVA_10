package com.example.starter_project_2025.system.demo.syllabus;

import com.example.starter_project_2025.exception.BusinessValidationException;
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
class SyllabusCoverageServiceTest {
    @Mock SyllabusRepository syllabuses;
    @Mock SyllabusCloRepository clos;
    @Mock SyllabusSectionRepository sections;
    @Mock SyllabusTopicRepository topics;
    @Mock SyllabusTopicCloLinkRepository links;
    @Mock SyllabusWorkflowService workflow;
    @InjectMocks SyllabusCoverageService service;

    private static SyllabusTopic topic(Long syllabusId) {
        Syllabus syllabus = new Syllabus();
        syllabus.setId(syllabusId);
        SyllabusSection section = new SyllabusSection();
        section.setId(5L);
        section.setSyllabus(syllabus);
        SyllabusTopic topic = new SyllabusTopic();
        topic.setId(10L);
        topic.setSection(section);
        return topic;
    }

    @Test
    void cannotAssignCloFromAnotherSyllabus() {
        when(topics.findById(10L)).thenReturn(Optional.of(topic(1L)));
        when(clos.findBySyllabus_IdOrderByOrderIndexAsc(1L)).thenReturn(List.of());

        assertThrows(BusinessValidationException.class, () -> service.setTopicClos(
                1L, 10L, new SyllabusCoverageService.TopicLinkInput(List.of(999L))
        ));
        verifyNoInteractions(links);
    }

    @Test
    void cannotAssignCloToForeignTopic() {
        when(topics.findById(10L)).thenReturn(Optional.of(topic(2L)));

        assertThrows(ResourceNotFoundException.class, () -> service.setTopicClos(
                1L, 10L, new SyllabusCoverageService.TopicLinkInput(List.of())
        ));
        verifyNoInteractions(links, clos);
    }

    @Test
    void nullCloListIsRejectedBeforeMutation() {
        assertThrows(BusinessValidationException.class, () -> service.setTopicClos(
                1L, 10L, new SyllabusCoverageService.TopicLinkInput(null)
        ));
        verifyNoInteractions(links, topics, clos);
    }
}
