package com.example.starter_project_2025.system.project.milestone.config;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** One-way, idempotent repair for legacy team milestones that were stored without their project scope. */
@Slf4j
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
@RequiredArgsConstructor
public class MilestoneProjectScopeBackfill implements ApplicationRunner {

    private final MilestoneRepository milestones;
    private final ProjectTeamRepository teams;

    @Value("${milestone.project-scope-backfill.enabled:true}")
    private boolean enabled;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!enabled) return;

        int updated = 0;
        int unresolved = 0;
        for (var milestone : milestones.findAllByProjectIdIsNull()) {
            var team = teams.findByIdAndTrainingClass_TenantId(milestone.getTeamId(), milestone.getTenantId());
            if (team.isEmpty() || team.get().getProjectId() == null) {
                unresolved++;
                continue;
            }
            updated += milestones.attachProjectScope(
                    milestone.getId(), milestone.getTenantId(), milestone.getTeamId(), team.get().getProjectId());
        }
        if (updated > 0 || unresolved > 0) {
            log.info("Milestone project-scope backfill completed: updated={}, unresolvedTeamOnly={}",
                    updated, unresolved);
        }
    }
}
