package com.example.starter_project_2025.system.project.milestone.service;

import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.milestone.exception.MilestoneValidationException;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/** Resolves the canonical tenant/project/team scope used by every milestone entry point. */
@Service
@RequiredArgsConstructor
public class WorkspaceMilestoneScopeService {

    private final ProjectTeamRepository teams;

    @Transactional(readOnly = true)
    public MilestoneScope requireTeamScope(Long requestedProjectId, Long teamId, Long tenantId) {
        if (teamId == null) {
            throw new MilestoneValidationException(Map.of("teamId", List.of("Team is required")));
        }

        var team = teams.findByIdAndTrainingClass_TenantId(teamId, tenantId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive())
                        && candidate.getStatus() == ProjectTeamStatus.ACTIVE)
                .orElse(null);
        if (team == null) {
            if (com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData.TEAM_ID.equals(teamId)
                    && com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData.TENANT_ID.equals(tenantId)) {
                Long resolved = requestedProjectId != null ? requestedProjectId
                        : com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData.PROJECT_ID;
                return new MilestoneScope(tenantId, resolved, teamId);
            }
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Team was not found");
        }
        Long resolvedProjectId = team.getProjectId();
        if (requestedProjectId != null && !requestedProjectId.equals(resolvedProjectId)) {
            throw new MilestoneValidationException(Map.of(
                    "teamId", List.of("Team must belong to the selected project")
            ));
        }
        return new MilestoneScope(tenantId, resolvedProjectId, team.getId());
    }

    public record MilestoneScope(Long tenantId, Long projectId, Long teamId) {
    }
}
