package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.dto.OnCreate;
import com.example.starter_project_2025.base.crud.dto.OnUpdate;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.study_session.StudySession;
import com.example.starter_project_2025.system.study_session.StudySessionDTO;
import com.example.starter_project_2025.system.study_session.StudySessionType;
import com.example.starter_project_2025.system.study_session.StudySessionValidator;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validation;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.*;

// No Spring context or database: validate request objects and JSON binding only.
class StudySessionValidationTest {

    private static final ValidatorFactory FACTORY = Validation.buildDefaultValidatorFactory();
    private final StudySessionValidator validator = new StudySessionValidator(FACTORY.getValidator());

    @AfterAll
    static void closeValidatorFactory() {
        FACTORY.close();
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "     ", "Java", "\u00A0\u00A0\u00A0\u00A0\u00A0", "\uFEFF\uFEFF\uFEFF\uFEFF\uFEFF"})
    void rejectsBlankOrTooShortTitle(String title) {
        var request = validRequest();
        request.setTitle(title);
        assertInvalid(request, "title");
    }

    @Test
    void enforcesTitleAndDescriptionBoundariesForBothValidationGroups() {
        var request = validRequest();
        request.setTitle("T".repeat(150));
        request.setDescription("D".repeat(500));
        assertValid(request);

        request.setTitle("T".repeat(151));
        request.setDescription("D".repeat(501));
        for (var group : new Class<?>[]{OnCreate.class, OnUpdate.class}) {
            var fields = FACTORY.getValidator().validate(request, group).stream()
                    .map(violation -> violation.getPropertyPath().toString()).toList();
            assertTrue(fields.contains("title"));
            assertTrue(fields.contains("description"));
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {"09:00", "08:59"})
    void rejectsEndTimeEqualToOrBeforeStart(String endTime) {
        var request = validRequest();
        request.setEndTime(LocalTime.parse(endTime));
        assertInvalid(request, "endTime");
    }

    @ParameterizedTest
    @ValueSource(strings = {"12345", "  ", "N", "John@Example"})
    void rejectsInvalidLecturer(String lecturer) {
        var request = validRequest();
        request.setLecturer(lecturer);
        assertInvalid(request, "lecturer");
    }

    @ParameterizedTest
    @ValueSource(strings = {"Nguyễn Thị Ánh", "Trần Văn An", "Anne-Marie O'Neill", "Dr. Nguyễn (An)", "Lecturer 2"})
    void acceptsUnicodeLecturerAndCommonNamePunctuation(String lecturer) {
        var request = validRequest();
        request.setLecturer(lecturer);
        assertValid(request);
    }

    @ParameterizedTest
    @ValueSource(strings = {"", "302", "Lab 301", "A-302", "Online", "Phòng A/302", "Lab #3 (A): 2"})
    void acceptsRealisticOptionalRoomValues(String room) {
        var request = validRequest();
        request.setRoom(room);
        assertValid(request);
    }

    @Test
    void rejectsWhitespaceOnlyOrTooLongRoomAndLecturer() {
        var request = validRequest();
        request.setRoom("   ");
        assertInvalid(request, "room");
        request.setRoom("A".repeat(31));
        request.setLecturer("A".repeat(101));
        assertInvalid(request, "room");
        assertInvalid(request, "lecturer");
    }

    @Test
    void updateValidatesEffectiveTimeRangeAndKeepsOmittedFields() {
        var existing = validEntity();
        var changes = new StudySessionDTO();
        changes.setStartTime(LocalTime.of(11, 0));
        var ctx = new ValidationContext();
        validator.validateUpdate(existing, changes, ctx);
        assertTrue(ctx.getErrors().containsKey("endTime"));
        assertEquals(LocalTime.of(9, 0), existing.getStartTime());

        changes.setEndTime(LocalTime.of(12, 0));
        var validCtx = new ValidationContext();
        validator.validateUpdate(existing, changes, validCtx);
        assertFalse(validCtx.hasErrors(), validCtx.getErrors().toString());
    }

    @Test
    void rejectsInvalidJsonDateTimeAndEnumWithoutInventingValues() {
        var mapper = new ObjectMapper().findAndRegisterModules();
        for (var json : new String[]{
                "{\"sessionDate\":\"2026-02-30\"}",
                "{\"sessionDate\":\"2026-13-01\"}",
                "{\"startTime\":\"25:00\"}",
                "{\"type\":\"PRACTICE\"}"}) {
            assertThrows(JsonProcessingException.class, () -> mapper.readValue(json, StudySessionDTO.class));
        }
        assertArrayEquals(new StudySessionType[]{StudySessionType.LECTURE, StudySessionType.LAB, StudySessionType.EXAM},
                StudySessionType.values());
    }

    @Test
    void allowsPastDateAndOptionalDescriptionWithoutChangingActiveStatus() {
        var request = validRequest();
        request.setSessionDate(LocalDate.of(2000, 1, 1));
        request.setDescription(null);
        request.setRoom(null);
        request.setIsActive(false);
        assertValid(request);
        assertFalse(request.getIsActive());
    }

    private void assertInvalid(StudySessionDTO request, String field) {
        var ctx = new ValidationContext();
        validator.validate(request, ctx);
        assertTrue(ctx.getErrors().containsKey(field), ctx.getErrors().toString());
    }

    private void assertValid(StudySessionDTO request) {
        var ctx = new ValidationContext();
        validator.validate(request, ctx);
        assertFalse(ctx.hasErrors(), ctx.getErrors().toString());
    }

    private StudySessionDTO validRequest() {
        var request = StudySessionDTO.builder()
                .subjectId(9L)
                .title("Java session")
                .sessionDate(LocalDate.of(2026, 10, 15))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .lecturer("Nguyễn Văn An")
                .type(StudySessionType.LECTURE)
                .build();
        request.setIsActive(true);
        return request;
    }

    private StudySession validEntity() {
        return StudySession.builder()
                .subjectId(9L)
                .title("Java session")
                .sessionDate(LocalDate.of(2026, 10, 15))
                .startTime(LocalTime.of(9, 0))
                .endTime(LocalTime.of(10, 0))
                .lecturer("Nguyễn Văn An")
                .type(StudySessionType.LECTURE)
                .build();
    }
}
