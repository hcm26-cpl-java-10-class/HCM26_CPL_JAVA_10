package com.example.starter_project_2025.system.project;

import jakarta.validation.constraints.*;
import java.util.List;

public final class ProjectHubDtos {
    private ProjectHubDtos() { }

    public record Member(Long id, String name, String email) { }
    public record Mentor(Long id, String name, String email) { }
    public record MentorAssignment(Long mentorId) { }
    public record ManagedMember(Long userId, String userCode, String displayName,
                                ProjectRole projectRole, ParticipationStatus status) { }
    public record MemberOption(Long userId, String userCode, String displayName) { }
    public record MembershipUpdate(@NotNull ProjectRole projectRole, @NotNull ParticipationStatus status) { }
    public record Charter(@Size(max = 2000) String mission, @Size(max = 2000) String definitionOfDone,
                          @Size(max = 255) String primaryChannel, @Size(max = 255) String coreHours,
                          @Size(max = 2000) String conflictResolution) {
        public static Charter from(Team team) {
            return new Charter(team.getMission(), team.getDefinitionOfDone(), team.getPrimaryChannel(),
                    team.getCoreHours(), team.getConflictResolution());
        }
    }
    public record TeamView(Long id, String code, String name, Long projectId, String projectName,
                           Long cohortId, String cohortName, Long mentorId, String mentorName,
                           List<Member> members, Charter charter) { }
}
