package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.system.demo.syllabus.dto.SyllabusModels.*;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusMaterialRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusSection;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusTopic;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicCloLinkRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusTopicRepository;

class SyllabusTopicServiceTest {
    @Test void deletingTopicDeletesCoverageLinksBeforeTopic() {
        var sections=mock(SyllabusSectionRepository.class);
        var topics=mock(SyllabusTopicRepository.class);
        var materials=mock(SyllabusMaterialRepository.class);
        var links=mock(SyllabusTopicCloLinkRepository.class);
        var workflow=mock(SyllabusWorkflowService.class);
        var queries=mock(SyllabusQueryService.class);
        Syllabus syllabus=new Syllabus(); syllabus.setId(7L);
        SyllabusSection section=new SyllabusSection(); section.setId(8L); section.setSyllabus(syllabus);
        SyllabusTopic topic=new SyllabusTopic(); topic.setId(9L); topic.setSection(section);
        when(sections.findById(8L)).thenReturn(Optional.of(section));
        when(topics.findById(9L)).thenReturn(Optional.of(topic));
        when(materials.countByTopic_Id(9L)).thenReturn(0L);
        var service=new SyllabusTopicService(sections,topics,materials,links,workflow,queries);
        service.deleteTopic(7L,8L,9L);
        var order=inOrder(links,topics);
        order.verify(links).deleteAllForTopic(9L);
        order.verify(topics).delete(topic);
    }
}
