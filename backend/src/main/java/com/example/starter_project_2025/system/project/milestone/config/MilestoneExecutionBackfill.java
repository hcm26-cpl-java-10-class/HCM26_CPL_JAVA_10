package com.example.starter_project_2025.system.project.milestone.config;

import com.example.starter_project_2025.system.project.milestone.domain.MilestoneStatus;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.submission.domain.MilestoneExecutionStatus;
import com.example.starter_project_2025.system.project.milestone.submission.repository.MilestoneSubmissionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Idempotent state backfill for milestones created before execution status existed. */
@Component
@RequiredArgsConstructor
public class MilestoneExecutionBackfill implements ApplicationRunner {
    private final MilestoneRepository milestones;
    private final MilestoneSubmissionRepository submissions;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (var milestone : milestones.findAll()) {
            if (milestone.getStatus() != MilestoneStatus.OPEN || milestone.getExecutionStatus() != null) continue;
            var prior = submissions.findByMilestoneIdAndTeamId(milestone.getId(), milestone.getTeamId());
            MilestoneExecutionStatus status = prior.map(s -> s.getExecutionStatus() == null
                    ? MilestoneExecutionStatus.IN_PROGRESS : s.getExecutionStatus())
                    .orElse(MilestoneExecutionStatus.IN_PROGRESS);
            milestone.setExecutionStatus(status, milestone.getUpdatedBy(), milestone.getUpdatedAt());
        }
    }
}
