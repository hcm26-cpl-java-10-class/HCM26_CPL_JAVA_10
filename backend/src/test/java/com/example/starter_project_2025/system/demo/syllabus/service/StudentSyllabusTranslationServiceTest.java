package com.example.starter_project_2025.system.demo.syllabus.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.demo.aicourse.AiTextClient;
import com.example.starter_project_2025.system.demo.syllabus.entity.Syllabus;
import com.example.starter_project_2025.system.demo.syllabus.entity.SyllabusStatus;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusRepository;
import com.example.starter_project_2025.system.demo.syllabus.repository.SyllabusSectionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StudentSyllabusTranslationServiceTest {
    @Mock StudentSyllabusCatalogService catalog;
    @Mock SyllabusRepository repository;
    @Mock SyllabusSectionRepository sections;
    @Mock AiTextClient ai;
    // Use a real Jackson mapper for the JSON prompt/response in unit tests.
    ObjectMapper mapper = new ObjectMapper();

    @Test void detailTranslationKeepsStableIdsCodesAndCourseMappingKeys() throws Exception {
        var topic = new StudentSyllabusCatalogService.TopicView(4L, "SQL Practice", 1, List.of(3L));
        var section = new StudentSyllabusCatalogService.SectionView(2L, "SQL Foundations", 1,
                "Understand databases", List.of(topic));
        var clo = new StudentSyllabusCatalogService.CloView(3L, "CLO1", "Build relational schemas", 1);
        var original = new StudentSyllabusCatalogService.Detail(7L, "SQL-101", "SQL Course",
                "Relational database basics", null, "Undergraduate", null, null, null, 10,
                List.of(section), List.of(clo), List.of());
        when(catalog.detail(7L)).thenReturn(original);
        when(ai.isConfigured()).thenReturn(true);
        when(ai.generateJson(anyString(), anyList(), eq(0.1))).thenAnswer(inv -> {
            @SuppressWarnings("unchecked")
            List<AiTextClient.Turn> turns = inv.getArgument(1);
            String input = turns.getFirst().text();
            JsonNode fields = mapper.readTree(input.substring(input.indexOf('[')));
            var output = mapper.createObjectNode();
            var values = output.putArray("translations");
            for (JsonNode field : fields) {
                String key = field.path("key").asText();
                values.addObject().put("key", key).put("text", "vi-" + field.path("text").asText());
            }
            return output;
        });
        var service = new StudentSyllabusTranslationService(catalog, repository, sections, ai, mapper);
        var translated = service.translateDetail(7L);
        assertEquals(7L, translated.id());
        assertEquals("SQL-101", translated.code());
        assertEquals("vi-SQL Course", translated.name());
        assertEquals("CLO1", translated.clos().getFirst().code());
        assertEquals(3L, translated.clos().getFirst().id());
        assertEquals(List.of(3L), translated.sections().getFirst().topics().getFirst().cloIds());
        assertEquals("vi-SQL Practice", translated.sections().getFirst().topics().getFirst().title());
        assertEquals("SQL Practice", original.sections().getFirst().topics().getFirst().title());
        verifyNoInteractions(repository, sections);
    }

    @Test void unpublishedSyllabusCannotBeTranslatedInCatalog() {
        Syllabus draft = new Syllabus();
        draft.setId(3L);
        draft.setStatus(SyllabusStatus.DRAFT);
        draft.setIsActive(true);
        when(repository.findById(3L)).thenReturn(Optional.of(draft));
        var service = new StudentSyllabusTranslationService(catalog, repository, sections, ai, mapper);
        assertThrows(ResourceNotFoundException.class,
                () -> service.translateList(new StudentSyllabusTranslationService.IdsRequest(List.of(3L))));
        verifyNoInteractions(ai);
    }

    @Test void listRejectsDuplicateAndTooManyIdsBeforeCallingAi() {
        var service = new StudentSyllabusTranslationService(catalog, repository, sections, ai, mapper);
        assertThrows(BadRequestException.class,
                () -> service.translateList(new StudentSyllabusTranslationService.IdsRequest(List.of(2L, 2L))));
        assertThrows(BadRequestException.class,
                () -> service.translateList(new StudentSyllabusTranslationService.IdsRequest(
                        List.of(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L))));
        verifyNoInteractions(ai);
    }

    @Test void rejectsMissingTranslationFieldsRatherThanMismatchingTopicNames() throws Exception {
        var original = new StudentSyllabusCatalogService.Detail(7L, "SQL-101", "SQL Course", null,
                null, null, null, null, null, null, List.of(), List.of(), List.of());
        when(catalog.detail(7L)).thenReturn(original);
        when(ai.isConfigured()).thenReturn(true);
        when(ai.generateJson(anyString(), anyList(), eq(0.1)))
                .thenReturn(mapper.readTree("{\"translations\":[]}"));
        var service = new StudentSyllabusTranslationService(catalog, repository, sections, ai, mapper);
        assertThrows(BadRequestException.class, () -> service.translateDetail(7L));
    }
}
