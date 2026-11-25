package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.submission.domain.SubmissionStatus;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class MilestoneSubmissionWindow {
    private final MilestoneSubmissionRepository submissions;
    private final Clock milestoneClock;

    public boolean canSubmit(Milestone milestone) {
        if (!milestone.isActive()) return false;
        if (milestone.lifecycleStatus() == MilestoneLifecycleStatus.IN_PROGRESS) return true;
        if (milestone.lifecycleStatus() != MilestoneLifecycleStatus.CHANGES_REQUESTED) return false;
        return submissions.findByMilestoneIdAndTeamId(milestone.getId(), milestone.getTeamId())
                .filter(row -> row.getSubmissionAttempts() > 0)
                .map(row -> row.getStatus() == SubmissionStatus.CHANGES_REQUESTED
                        || row.getStatus() == SubmissionStatus.DRAFT)
                .orElse(false);
    }

    public boolean canSubmitNow(Milestone milestone) {
        if (!canSubmit(milestone)) return false;
        Instant cutoff = milestone.getLatePolicyType() == LatePolicyType.ALLOW_LATE
                && milestone.getLateUntil() != null ? milestone.getLateUntil() : milestone.getDeadline();
        return cutoff == null || !milestoneClock.instant().isAfter(cutoff);
    }
}
