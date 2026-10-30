package com.example.starter_project_2025.service;

import com.example.starter_project_2025.system.schedule.*;
import com.example.starter_project_2025.system.schedule_validation.*;
import com.example.starter_project_2025.base.crud.validation.ValidationContext;
import org.junit.jupiter.api.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyList;

class ScheduleValidationServiceImplTest {
    ScheduleValidationEngine engine;
    ScheduleCandidateAdapter adapter;
    ScheduleValidationServiceImpl service;
    @BeforeEach void setup() {
        engine=mock(ScheduleValidationEngine.class);adapter=mock(ScheduleCandidateAdapter.class);
        service=new ScheduleValidationServiceImpl(engine,adapter);
        when(adapter.adapt(anyList())).thenReturn(List.of());
    }
    @Test void legacyContractKeepsRelatedSessionAndConflictType() {
        when(engine.validate(anyList())).thenReturn(new com.example.starter_project_2025.system.schedule.ScheduleValidationResult(
            false,"Asia/Ho_Chi_Minh",List.of(new ScheduleIssue("CLASS_CONFLICT","classId","Trùng lớp",0,null,99L,"Java",null,null))));
        var result=service.validate(SessionConflictCandidate.builder().classId(1L).trainerId(1L).build());
        assertFalse(result.isValid());assertEquals(99L,result.getConflicts().getFirst().getConflictingSessionId());
        assertEquals(ScheduleConflictType.CLASS_OVERLAP,result.getConflicts().getFirst().getType());
        verify(adapter).adapt(anyList());verify(engine).validate(anyList());
    }
    @Test void conditionsReachLegacyFieldValidation() {
        when(engine.validate(anyList())).thenReturn(new com.example.starter_project_2025.system.schedule.ScheduleValidationResult(
            false,"Asia/Ho_Chi_Minh",List.of(new ScheduleIssue("HOLIDAY","startTime","Ngày nghỉ",0,null,null,null,null,null))));
        var ctx=new ValidationContext();
        service.addValidationErrors(SessionConflictCandidate.builder().classId(1L).trainerId(1L).build(),ctx);
        assertEquals(List.of("Ngày nghỉ"),ctx.getErrors().get("startTime"));
    }
    @Test void validResultHasNoLegacyConflicts() {
        when(engine.validate(anyList())).thenReturn(new com.example.starter_project_2025.system.schedule.ScheduleValidationResult(true,"Asia/Ho_Chi_Minh",List.of()));
        assertTrue(service.validate(SessionConflictCandidate.builder().classId(1L).trainerId(1L).build()).isValid());
    }
}