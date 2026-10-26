package com.example.starter_project_2025.system.project.milestone.submission.mock;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Local/demo assignment fixture. Production must provide a scope adapter backed by Project/Team membership. */
@Component
@Profile("!milestone-real-integrations")
public class MockArtifactSubmissionScopeAdapter implements ArtifactSubmissionScopePort {
    private final Map<UUID, Set<UUID>> projectAssignments;

    public MockArtifactSubmissionScopeAdapter(
            @Value("${milestone.mock.submission.assignments:student@example.com=11111111-1111-1111-1111-111111111111}") String assignments) {
        this.projectAssignments = Arrays.stream(assignments.split(","))
                .map(String::trim).filter(value -> !value.isEmpty())
                .map(value -> value.split("=", 2))
                .filter(pair -> pair.length == 2 && !pair[0].isBlank() && !pair[1].isBlank())
                .collect(Collectors.toUnmodifiableMap(
                        pair -> UUID.nameUUIDFromBytes(pair[0].trim().getBytes(StandardCharsets.UTF_8)),
                        pair -> Arrays.stream(pair[1].split("\\+"))
                                .map(String::trim).filter(id -> !id.isEmpty()).map(UUID::fromString)
                                .collect(Collectors.toUnmodifiableSet()),
                        (left, right) -> {
                            java.util.Set<UUID> combined = new java.util.HashSet<>(left);
                            combined.addAll(right);
                            return Set.copyOf(combined);
                        }));
    }

    @Override
    public void requireStudentProjectAccess(UUID projectId, UUID actorId, UUID tenantId) {
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)
                || !projectAssignments.getOrDefault(actorId, Set.of()).contains(projectId)) {
            throw new AccessDeniedException("Student is not assigned to this demo project");
        }
    }
}
