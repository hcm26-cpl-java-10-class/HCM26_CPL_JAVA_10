package com.example.starter_project_2025.system.project.alert;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import java.util.*;
@Component @RequiredArgsConstructor
public class PersistedAlertMilestoneProgressSource implements AlertMilestoneProgressSource {
    private final AlertMilestoneConfigRepository configs;
    public Optional<Set<Long>> backlogItemIds(UUID milestoneId,Long teamId,Long tenantId) {
        return configs.findById(milestoneId).filter(row->row.getTeamId().equals(teamId)&&row.getTenantId().equals(tenantId))
                .map(row->Set.copyOf(row.getBacklogItemIds()));
    }
}
