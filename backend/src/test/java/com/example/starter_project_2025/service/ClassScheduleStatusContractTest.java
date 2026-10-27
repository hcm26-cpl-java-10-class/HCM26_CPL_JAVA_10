package com.example.starter_project_2025.service;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.system.demo.session.SessionRepository;
import com.example.starter_project_2025.system.schedule_version.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClassScheduleStatusContractTest {
    @ParameterizedTest
    @EnumSource(value = ScheduleVersionStatus.class, names = {"DRAFT", "ARCHIVED"})
    void theDirectClassStatusRouteCannotRestartTheLegacyDraftWorkflow(ScheduleVersionStatus status) {
        var repository = mock(ScheduleVersionRepository.class);
        var service = new ScheduleVersionServiceImpl(repository, mock(ScheduleVersionMapper.class), mock(SessionRepository.class));
        assertThrows(BadRequestException.class, () -> service.updateStatus("1", status));
        verifyNoInteractions(repository);
    }
    @Test void aMissingStatusDoesNotCreateAnInvalidScheduleRecord() {
        var repository = mock(ScheduleVersionRepository.class);
        var service = new ScheduleVersionServiceImpl(repository, mock(ScheduleVersionMapper.class), mock(SessionRepository.class));
        assertThrows(BadRequestException.class, () -> service.updateStatus("1", null));
        verifyNoInteractions(repository);
    }
}
