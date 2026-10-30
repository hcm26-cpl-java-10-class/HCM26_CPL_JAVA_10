package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditRepository;
import com.example.starter_project_2025.system.project.milestone.audit.MilestoneAuditLog;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventWriter;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

@Component
@RequiredArgsConstructor
public class MilestoneDeadlineJob {
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;
    private final MilestoneAuditRepository audits;
    private final OutboxEventWriter outbox;
    private final Clock milestoneClock;

    @Scheduled(fixedDelayString = "${app.milestone.start-check-ms:60000}")
    @Transactional
    public void openScheduledMilestones() {
        Instant now = milestoneClock.instant();
        for (Milestone milestone : milestones.findByActiveTrueAndAutoStartEnabledTrueAndLifecycleState(
                com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus.PLANNED)) {
            if (milestone.scheduledStartAt() == null || now.isBefore(milestone.scheduledStartAt())) continue;
            milestone.startAutomatically(now);
            audits.save(MilestoneAuditLog.statusEvent(milestone.getId(), milestone.getProjectId(),
                    milestone.getTenantId(), milestone.getUpdatedBy(), "MILESTONE_AUTO_STARTED", null,
                    "{\"from\":\"PLANNED\",\"to\":\"IN_PROGRESS\"}", now));
            outbox.writeMilestoneStarted(milestone, now);
        }
    }

    @Scheduled(fixedDelayString = "${app.milestone.deadline-check-ms:60000}")
    @Transactional
    public void closeSubmissionWindows() {
        Instant now = milestoneClock.instant();
        for (Milestone milestone : milestones.findByActiveTrueAndStatusAndExecutionStatus(
                MilestoneStatus.OPEN, MilestoneExecutionStatus.IN_PROGRESS)) {
            Instant cutoff = milestone.getLatePolicyType() == LatePolicyType.ALLOW_LATE
                    && milestone.getLateUntil() != null ? milestone.getLateUntil() : milestone.getDeadline();
            if (cutoff != null && !now.isBefore(cutoff)) {
                if (submissions.findByMilestoneIdAndTeamId(milestone.getId(), milestone.getTeamId())
                        .filter(row -> row.getSubmissionAttempts() > 0).isPresent()) continue;
                var actor = milestone.getUpdatedBy() == null ? milestone.getCreatedBy() : milestone.getUpdatedBy();
                milestone.rejectExpired(actor, now);
                audits.save(MilestoneAuditLog.statusEvent(milestone.getId(), milestone.getProjectId(),
                        milestone.getTenantId(), actor, "MILESTONE_EXPIRED_REJECTED", null,
                        "{\"severity\":\"HIGH\",\"reason\":\"NO_SUBMISSION\"}", now));
                outbox.writeMilestoneRejected(milestone, "MAX_DEADLINE_NO_SUBMISSION", now);
            }
        }
    }
}
