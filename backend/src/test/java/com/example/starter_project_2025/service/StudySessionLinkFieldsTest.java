package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.study_session.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mapstruct.factory.Mappers;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StudySessionLinkFieldsTest {
    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private static final List<String> IDS = List.of("classId", "teachingAssignmentId", "programSubjectId", "trainerId", "roomId");
    private final StudySessionMapper mapper = Mappers.getMapper(StudySessionMapper.class);
    private final StudySessionValidator validator = new StudySessionValidator(FACTORY.getValidator());

    @AfterAll
    static void closeFactory() { FACTORY.close(); }

    @Test
    void legacyCreateAndImportAllowNullLinksWithoutInferringFromNames() {
        var dto = legacyRequest();
        var ctx = new ValidationContext();
        validator.validate(dto, ctx);
        assertFalse(ctx.hasErrors());
        var entity = mapper.toEntity(dto);
        var importCtx = new ValidationContext();
        validator.validateImport(entity, importCtx);
        assertFalse(importCtx.hasErrors());
        assertLinksEqual(new StudySessionDTO(), mapper.toResponse(entity));
    }

    @Test
    void mapsLinksInBothDirectionsAndPreservesThemOnPartialUpdate() {
        var dto = legacyRequest();
        dto.setClassId(11L);
        dto.setTeachingAssignmentId(12L);
        dto.setProgramSubjectId(13L);
        dto.setTrainerId(14L);
        dto.setRoomId(15L);
        dto.setMeetingUrl("https://example.com/meeting");
        var entity = mapper.toEntity(dto);
        assertLinksEqual(dto, mapper.toResponse(entity));
        var changes = new StudySessionDTO();
        changes.setTitle("Updated lesson");
        var ctx = new ValidationContext();
        validator.validateUpdate(entity, changes, ctx);
        assertFalse(ctx.hasErrors());
        mapper.update(entity, changes);
        assertLinksEqual(dto, mapper.toResponse(entity));
        changes.setRoomId(16L);
        changes.setMeetingUrl("https://example.com/updated");
        mapper.update(entity, changes);
        assertEquals(16L, entity.getRoomId());
        assertEquals(changes.getMeetingUrl(), entity.getMeetingUrl());
        assertEquals(12L, entity.getTeachingAssignmentId());
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1, Long.MIN_VALUE})
    void rejectsNonPositiveIdsForCreateUpdateAndImport(long value) throws Exception {
        for (var field : IDS) {
            var dto = legacyRequest();
            StudySessionDTO.class.getMethod("set" + capitalize(field), Long.class).invoke(dto, value);
            for (var group : new Class<?>[]{OnCreate.class, OnUpdate.class}) {
                assertTrue(FACTORY.getValidator().validate(dto, group).stream()
                        .anyMatch(v -> v.getPropertyPath().toString().equals(field)), field);
            }
            var updateCtx = new ValidationContext();
            validator.validateUpdate(mapper.toEntity(legacyRequest()), dto, updateCtx);
            assertTrue(updateCtx.getErrors().containsKey(field));
            var importCtx = new ValidationContext();
            validator.validateImport(mapper.toEntity(dto), importCtx);
            assertTrue(importCtx.getErrors().containsKey(field));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.5", "1.0", "true", "\"abc\"", "\"12\"", "9223372036854775808", "[]", "{}"})
    void rejectsInvalidJsonIdTypesAndOverflow(String value) {
        for (var field : IDS) {
            assertThrows(JsonProcessingException.class, () -> new ObjectMapper().readValue(
                    "{\"" + field + "\":" + value + "}", StudySessionDTO.class), field);
        }
    }

    @Test
    void acceptsNullAndLongMaximumJsonIdsAndBoundsMeetingUrl() throws Exception {
        for (var field : IDS) {
            var json = new ObjectMapper();
            var getter = StudySessionDTO.class.getMethod("get" + capitalize(field));
            assertNull(getter.invoke(json.readValue("{\"" + field + "\":null}", StudySessionDTO.class)));
            assertEquals(Long.MAX_VALUE, getter.invoke(json.readValue(
                    "{\"" + field + "\":9223372036854775807}", StudySessionDTO.class)));
        }
        var dto = legacyRequest();
        dto.setMeetingUrl("a".repeat(2048));
        assertTrue(FACTORY.getValidator().validate(dto, OnCreate.class).isEmpty());
        dto.setMeetingUrl("a".repeat(2049));
        var ctx = new ValidationContext();
        validator.validateUpdate(mapper.toEntity(legacyRequest()), dto, ctx);
        assertTrue(ctx.getErrors().containsKey("meetingUrl"));
    }

    private void assertLinksEqual(StudySessionDTO expected, StudySessionDTO actual) {
        assertEquals(expected.getClassId(), actual.getClassId());
        assertEquals(expected.getTeachingAssignmentId(), actual.getTeachingAssignmentId());
        assertEquals(expected.getProgramSubjectId(), actual.getProgramSubjectId());
        assertEquals(expected.getTrainerId(), actual.getTrainerId());
        assertEquals(expected.getRoomId(), actual.getRoomId());
        assertEquals(expected.getMeetingUrl(), actual.getMeetingUrl());
    }

    private String capitalize(String field) { return Character.toUpperCase(field.charAt(0)) + field.substring(1); }

    private StudySessionDTO legacyRequest() {
        var request = StudySessionDTO.builder().subjectId(1L).title("Legacy Java lesson")
                .sessionDate(LocalDate.of(2026, 10, 19)).startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(9, 0)).lecturer("Nguyen Van An").room("Lab 301")
                .type(StudySessionType.LECTURE).build();
        request.setIsActive(true);
        return request;
    }
}
