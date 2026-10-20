package com.example.starter_project_2025.system.schedule;

import com.example.starter_project_2025.system.schedule.conflict.ScheduleConflictServiceImpl;
import com.example.starter_project_2025.system.schedule.conflict.dto.*;
import com.example.starter_project_2025.system.schedule_version.*;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ScheduleCompatibilityTest {
    ScheduleValidationEngine engine;
    ScheduleCandidateAdapter adapter;
    ScheduleVersionRepository versions;
    ScheduleConflictServiceImpl facade;
    ScheduleValidationRequest request;
    @BeforeEach void setup() {
        engine=mock(ScheduleValidationEngine.class);adapter=mock(ScheduleCandidateAdapter.class);versions=mock(ScheduleVersionRepository.class);
        facade=new ScheduleConflictServiceImpl(engine,adapter,versions);
        when(versions.findById(1L)).thenReturn(Optional.of(ScheduleVersion.builder().classId("1").status(ScheduleVersionStatus.DRAFT).build()));
        var candidate=new SessionCandidateRequest();candidate.setCandidateKey("first");candidate.setClassId(1L);
        request=new ScheduleValidationRequest();request.setSessions(List.of(candidate));
        when(adapter.adapt(anyList())).thenReturn(List.of());
    }
    @Test void existingApiKeepsCandidateKeysAndRelatedIds() {
        when(engine.validate(anyList())).thenReturn(new ScheduleValidationResult(false,"Asia/Ho_Chi_Minh",
                List.of(new ScheduleIssue("HOLIDAY","startTime","The session falls on a scheduled holiday.",0,null,7L,"Java",null,null))));
        var response=facade.validateCandidates(1L,request);
        assertFalse(response.valid());assertEquals(1L,response.versionId());
        assertEquals("first",response.issues().getFirst().candidateKey());
        assertEquals(7L,response.issues().getFirst().conflictSessionId());
    }
    @Test void unknownVersionIsRejected() {
        assertThrows(com.example.starter_project_2025.exception.ResourceNotFoundException.class,()->facade.validateCandidates(999L,request));
        verifyNoInteractions(engine);
    }
    @Test void candidateMustBelongToVersionClass() {
        request.getSessions().getFirst().setClassId(2L);
        assertThrows(IllegalArgumentException.class,()->facade.validateCandidates(1L,request));
        verifyNoInteractions(engine);
    }
    @Test void repeatedKeysCannotMakeErrorsAmbiguous() {
        request.setSessions(List.of(request.getSessions().getFirst(),request.getSessions().getFirst()));
        assertThrows(IllegalArgumentException.class,()->facade.validateCandidates(1L,request));
        verifyNoInteractions(engine);
    }
}
