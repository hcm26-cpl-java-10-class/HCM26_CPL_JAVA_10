package com.example.starter_project_2025.system.project.milestone.config;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.integration.port.TenantSettingsPort;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class MilestoneStartScheduleBackfillTest {
    @Test
    void preservesLegacyOpeningHourAndCanRunAgain() {
        Instant deadline = Instant.parse("2026-11-10T12:30:00Z");
        Milestone scheduled = milestone(deadline);
        ReflectionTestUtils.setField(scheduled, "deadlineOffsetDays", 7);
        ReflectionTestUtils.setField(scheduled, "autoStartEnabled", true);
        Milestone unscheduled = milestone(deadline);
        ReflectionTestUtils.setField(unscheduled, "deadlineOffsetDays", 7);
        MilestoneRepository repository = mock(MilestoneRepository.class);
        TenantSettingsPort settings = mock(TenantSettingsPort.class);
        when(repository.findAll()).thenReturn(List.of(scheduled, unscheduled));
        when(settings.requireTimeZone(1L)).thenReturn(ZoneId.of("Asia/Ho_Chi_Minh"));

        var backfill = new MilestoneStartScheduleBackfill(repository, settings);
        backfill.run(null);
        backfill.run(null);

        assertEquals(Instant.parse("2026-11-03T12:30:00Z"), scheduled.scheduledStartAt());
        assertEquals(LocalDate.parse("2026-11-03"), scheduled.getStartDate());
        assertEquals(null, unscheduled.scheduledStartAt());
        verify(settings, times(1)).requireTimeZone(1L);
    }

    private Milestone milestone(Instant deadline) {
        return Milestone.create(1L, 1L, 1L, "Legacy", null, deadline, true, UUID.randomUUID(), null,
                LatePolicyType.NO_LATE, null, null, UUID.randomUUID(), deadline.minusSeconds(86400));
    }
}
