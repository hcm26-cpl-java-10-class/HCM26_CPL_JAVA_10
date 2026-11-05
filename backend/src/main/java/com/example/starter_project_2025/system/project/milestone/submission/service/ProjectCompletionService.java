package com.example.starter_project_2025.system.project.milestone.submission.service;

import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.milestone.domain.MilestoneLifecycleStatus;
import com.example.starter_project_2025.system.project.milestone.submission.integration.ProjectCompletionPort;
import com.example.starter_project_2025.system.project.milestone.submission.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProjectCompletionService {
    private final MilestoneRepository milestones;
    private final ProjectCompletionPort completionPort;

    @Transactional
    public boolean reevaluate(Long tenantId, Long projectId, Long teamId, UUID actorId, Instant now) {
        if (!completionPort.isActive(projectId, tenantId)) return false;
        var active = milestones.findAllByProjectIdAndTenantId(projectId, tenantId, Pageable.unpaged())
                .stream().filter(item -> item.isActive() && teamId.equals(item.getTeamId())).toList();
        if (active.isEmpty() || active.stream().anyMatch(item -> item.lifecycleStatus() != MilestoneLifecycleStatus.ACCEPTED))
            return false;
        completionPort.complete(projectId, teamId, actorId, now);
        return true;
    }
}
