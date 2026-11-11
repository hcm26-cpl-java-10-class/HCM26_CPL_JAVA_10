package com.example.starter_project_2025.service;

import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import com.example.starter_project_2025.system.study_session.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.time.LocalTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StudySessionScheduleCandidateAdapterTest {
    private final StudySessionAssignmentResolver resolver = mock(StudySessionAssignmentResolver.class);
    private final StudySessionScheduleCandidateAdapter adapter = new StudySessionScheduleCandidateAdapter(resolver);

    @Test
    void mapsDatesAndVerifiedIdsWithoutActivatingTopicOrNameInference() {
        var entity = session();
        entity.setTrainerId(null);
        entity.setProgramSubjectId(null);
        when(resolver.resolveImport(eq(entity), any())).thenReturn(new StudySessionAssignmentResolver.ResolvedAssignment(4L, 5L));
        var result = adapter.forCreate(entity);
        var draft = result.draft();
        assertEquals(entity.getSessionDate().atTime(8, 0), draft.startTime());
        assertEquals(entity.getSessionDate().atTime(9, 0), draft.endTime());
        assertEquals(2L, draft.classId());
        assertEquals(1L, draft.teachingAssignmentId());
        assertEquals(5L, draft.trainerId());
        assertEquals(6L, draft.roomId());
        assertEquals(entity.getMeetingUrl(), draft.meetingUrl());
        assertEquals(entity.getTitle(), draft.title());
        assertEquals(4L, result.programSubjectId());
        assertNull(draft.topicId());
        assertNull(draft.location());
        assertNull(draft.id());
        assertNull(result.identity());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("TOPIC_MAPPING_PENDING")));
        assertNull(entity.getTrainerId());
        assertNull(entity.getProgramSubjectId());
        assertEquals(SessionStatus.SCHEDULED, entity.getStatus());
        assertTrue(entity.getIsActive());
        assertThrows(UnsupportedOperationException.class, () -> result.diagnostics().clear());
    }

    @Test
    void createIgnoresCopiedIdentityAndEditKeepsOnlySourceQualifiedIdentity() {
        var entity = session();
        entity.setId(7L);
        when(resolver.resolveImport(eq(entity), any())).thenReturn(new StudySessionAssignmentResolver.ResolvedAssignment(4L, 5L));
        assertNull(adapter.forCreate(entity).identity());
        var edit = adapter.forEdit(entity);
        var key = new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.STUDY_SESSION, 7L);
        assertEquals(key, edit.identity());
        assertNotEquals(new StudySessionScheduleIdentity(StudySessionScheduleIdentity.Source.DEMO_SESSION, 7L), key);
        assertNull(edit.draft().id()); // Must not accidentally target demo sessions.id=7.
        assertTrue(edit.diagnostics().stream().anyMatch(d -> d.code().equals("ENGINE_SOURCE_CONTRACT_PENDING")));
    }

    @Test
    void legacyMissingIdsReturnsStructuredDiagnosticsWithoutLookingUpNames() {
        var entity = session();
        entity.setClassId(null);
        entity.setTeachingAssignmentId(null);
        entity.setTrainerId(null);
        entity.setRoomId(null);
        entity.setMeetingUrl(null);
        var result = adapter.forEdit(entity);
        for (var field : new String[]{"id", "classId", "teachingAssignmentId", "trainerId", "roomId"}) {
            assertTrue(result.diagnostics().stream().anyMatch(d -> d.field().equals(field)), field);
        }
        assertNull(result.draft().trainerId());
        assertNull(result.draft().roomId());
        assertNull(result.draft().location());
        verifyNoInteractions(resolver);
    }

    @ParameterizedTest
    @ValueSource(longs = {0, -1})
    void invalidIdsDoNotReachResolver(long id) {
        var entity = session();
        entity.setClassId(id);
        var result = adapter.forCreate(entity);
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("INVALID_ID") && d.field().equals("classId")));
        assertNull(result.draft().trainerId());
        verifyNoInteractions(resolver);
    }

    @Test
    void rejectedAssignmentDoesNotLeakUnverifiedTrainerIntoDraft() {
        var entity = session();
        when(resolver.resolveImport(eq(entity), any())).thenAnswer(call -> {
            call.getArgument(1, ValidationContext.class).add("trainerId", "Trainer mismatch");
            return null;
        });
        var result = adapter.forCreate(entity);
        assertNull(result.draft().trainerId());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.code().equals("ASSIGNMENT_INVALID") && d.field().equals("trainerId")));
        assertEquals(5L, entity.getTrainerId());
    }

    @Test
    void missingTimesAreReportedWithoutInventingDatesOrChangingStatus() {
        var entity = session();
        entity.setSessionDate(null);
        entity.setStartTime(null);
        entity.setStatus(SessionStatus.COMPLETED);
        entity.setIsActive(false);
        var result = adapter.forCreate(entity);
        assertNull(result.draft().startTime());
        assertNull(result.draft().endTime());
        assertTrue(result.diagnostics().stream().anyMatch(d -> d.field().equals("sessionDate")));
        assertEquals(SessionStatus.COMPLETED, entity.getStatus());
        assertFalse(entity.getIsActive());
        assertNull(adapter.forCreate(null).draft());
    }

    private StudySession session() {
        return StudySession.builder().classId(2L).teachingAssignmentId(1L).subjectId(3L)
                .programSubjectId(4L).trainerId(5L).roomId(6L).meetingUrl("https://example.com/lesson")
                .title("Java lesson").room("Room name only").lecturer("Lecturer name only")
                .sessionDate(LocalDate.of(2026, 10, 27)).startTime(LocalTime.of(8, 0))
                .endTime(LocalTime.of(9, 0)).build();
    }
}
