package com.example.starter_project_2025.system.project.milestone.submission.mock;

import com.example.starter_project_2025.system.project.milestone.integration.mock.MockMilestoneData;
import com.example.starter_project_2025.system.project.milestone.submission.port.ArtifactSubmissionScopePort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Profile;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Set;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Local/demo assignment fixture. Production must provide a scope adapter backed by Project/Team membership. */
@Component
@Profile("milestone-mock | test")
public class MockArtifactSubmissionScopeAdapter implements ArtifactSubmissionScopePort {
    private final Map<UUID, Set<Long>> projectAssignments;
    private final Map<UUID, Set<Long>> teamAssignments;

    public MockArtifactSubmissionScopeAdapter(
            @Value("${milestone.mock.submission.assignments:student@example.com=1}") String assignments,
            @Value("${milestone.mock.submission.team-assignments:student@example.com=1}") String teamAssignments) {
        this.projectAssignments = parse(assignments);
        this.teamAssignments = parse(teamAssignments);
    }

    private Map<UUID, Set<Long>> parse(String assignments) {
        return Arrays.stream(assignments.split(","))
                .map(String::trim).filter(value -> !value.isEmpty())
                .map(value -> value.split("=", 2))
                .filter(pair -> pair.length == 2 && !pair[0].isBlank() && !pair[1].isBlank())
                .collect(Collectors.toUnmodifiableMap(
                        pair -> UUID.nameUUIDFromBytes(pair[0].trim().getBytes(StandardCharsets.UTF_8)),
                        pair -> Arrays.stream(pair[1].split("\\+"))
                                .map(String::trim).filter(id -> !id.isEmpty()).map(Long::valueOf)
                                .collect(Collectors.toUnmodifiableSet()),
                        (left, right) -> {
                            java.util.Set<Long> combined = new java.util.HashSet<>(left);
                            combined.addAll(right);
                            return Set.copyOf(combined);
                        }));
    }

    @Override
    public void requireStudentProjectAccess(Long projectId, UUID actorId, Long tenantId) {
        if (isAdministrator()) {
            return;
        }
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)
                || !projectAssignments.getOrDefault(actorId, Set.of()).contains(projectId)) {
            throw new AccessDeniedException("Student is not assigned to this demo project");
        }
    }

    @Override
    public void requireStudentTeamAccess(Long teamId, UUID actorId, Long tenantId) {
        if (isAdministrator()) {
            return;
        }
        if (!MockMilestoneData.TENANT_ID.equals(tenantId)
                || !teamAssignments.getOrDefault(actorId, Set.of()).contains(teamId)) {
            throw new AccessDeniedException("Student is not assigned to this demo team");
        }
    }

    private boolean isAdministrator() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority())
                        || "ROLE_ADMINISTRATOR".equals(authority.getAuthority()));
    }
}
