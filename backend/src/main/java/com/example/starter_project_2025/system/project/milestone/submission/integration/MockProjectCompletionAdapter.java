package com.example.starter_project_2025.system.project.milestone.submission.integration;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.*;

@Slf4j
@Component
@Profile("!milestone-real-integrations")
public class MockProjectCompletionAdapter implements ProjectCompletionPort {
    private final Set<Long> completed = java.util.concurrent.ConcurrentHashMap.newKeySet();

    @Override public boolean isActive(Long projectId, Long tenantId) {
        return MockMilestoneData.TENANT_ID.equals(tenantId) && !completed.contains(projectId);
    }

    @Override public void complete(Long projectId, Long teamId, UUID actorId, Instant completedAt) {
        completed.add(projectId);
        log.info("Mock BR-UNI-12 completion: project={}, team={}, actor={}, at={}",
                projectId, teamId, actorId, completedAt);
    }
}
