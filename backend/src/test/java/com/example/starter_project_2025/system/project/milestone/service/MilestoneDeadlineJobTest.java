package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MilestoneDeadlineJobTest {
    @Test
    void opensOnlyPublishedMilestonesWhenScheduledTimeArrives() {
        Instant now = Instant.parse("2026-10-29T12:00:00Z");
        UUID actor = UUID.randomUUID();
        Milestone due = Milestone.create(1L, 1L, 1L, "Due", null, now.plusSeconds(86400), true,
                UUID.randomUUID(), null, LatePolicyType.NO_LATE, null, null, actor, now.minusSeconds(86400));
        due.configureAutoStart(1, true);
        Milestone future = Milestone.create(1L, 1L, 1L, "Future", null, now.plusSeconds(172800), true,
                UUID.randomUUID(), null, LatePolicyType.NO_LATE, null, null, actor, now);
        future.configureAutoStart(1, true);
        Milestone draft = Milestone.create(1L, 1L, 1L, "Draft", null, now.plusSeconds(86400), true,
                UUID.randomUUID(), null, LatePolicyType.NO_LATE, null, null, actor, now);
        draft.configureAutoStart(1, false);
        MilestoneRepository repository = mock(MilestoneRepository.class);
        when(repository.findByActiveTrueAndAutoStartEnabledTrueAndLifecycleState(MilestoneLifecycleStatus.PLANNED))
                .thenReturn(List.of(due, future));
        new MilestoneDeadlineJob(repository, mock(MilestoneSubmissionRepository.class),
                mock(MilestoneAuditRepository.class), mock(OutboxEventWriter.class),
                Clock.fixed(now, ZoneOffset.UTC)).openScheduledMilestones();
        assertEquals(MilestoneLifecycleStatus.IN_PROGRESS, due.lifecycleStatus());
        assertEquals(MilestoneLifecycleStatus.PLANNED, future.lifecycleStatus());
        assertEquals(MilestoneLifecycleStatus.PLANNED, draft.lifecycleStatus());
    }

    @Test
    void rejectsUnsubmittedMilestoneAtMaximumDeadlineAndKeepsLateWindowOpen() {
        Instant now = Instant.parse("2026-10-29T12:00:00Z");
        UUID actor = UUID.randomUUID();
        Milestone expired = milestone(actor, now.minusSeconds(60), null);
        Milestone lateOpen = milestone(actor, now.minusSeconds(60), now.plusSeconds(60));
        MilestoneRepository repository = mock(MilestoneRepository.class);
        when(repository.findByActiveTrueAndStatusAndExecutionStatus(MilestoneStatus.OPEN,
                MilestoneExecutionStatus.IN_PROGRESS)).thenReturn(List.of(expired, lateOpen));

        MilestoneSubmissionRepository submissions = mock(MilestoneSubmissionRepository.class);
        when(submissions.findByMilestoneIdAndTeamId(expired.getId(), expired.getTeamId()))
                .thenReturn(java.util.Optional.empty());
        new MilestoneDeadlineJob(repository, submissions, mock(MilestoneAuditRepository.class),
                mock(OutboxEventWriter.class), Clock.fixed(now, ZoneOffset.UTC)).closeSubmissionWindows();

        assertEquals(MilestoneLifecycleStatus.REJECTED, expired.lifecycleStatus());
        assertEquals(MilestoneLifecycleStatus.IN_PROGRESS, lateOpen.lifecycleStatus());
    }

    private Milestone milestone(UUID actor, Instant deadline, Instant lateUntil) {
        Milestone value = Milestone.create(1L, 1L, 1L, "Delivery", null, deadline, true,
                UUID.randomUUID(), null, lateUntil == null ? LatePolicyType.NO_LATE : LatePolicyType.ALLOW_LATE,
                lateUntil, null, actor, deadline.minusSeconds(3600));
        value.openForWork(actor, deadline.minusSeconds(1800));
        value.start(actor, deadline.minusSeconds(1200));
        return value;
    }
}
