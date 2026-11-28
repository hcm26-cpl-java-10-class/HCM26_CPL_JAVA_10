package com.example.starter_project_2025.system.project.dto;

import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.ProjectTeam;

import jakarta.validation.constraints.*;
import java.util.List;

public final class ProjectHubDtos {
    private ProjectHubDtos() { }

    public record Member(Long id, String name, String email, String userCode) { }
    public record Mentor(Long id, String name, String email) { }
    public record MentorAssignment(Long mentorId) { }
    public record Charter(@Size(max = 2000) String mission, @Size(max = 2000) String definitionOfDone,
                          @Size(max = 255) String primaryChannel, @Size(max = 255) String coreHours,
                          @Size(max = 2000) String conflictResolution,
                          @NotNull @PositiveOrZero Long version,
                          @jakarta.validation.Valid @Size(max = 100) List<ResponsibilityInput> responsibilities) {
        public Charter(String mission, String definitionOfDone, String primaryChannel, String coreHours,
                       String conflictResolution, Long version) {
            this(mission, definitionOfDone, primaryChannel, coreHours, conflictResolution, version, null);
        }
        /** Compatibility for existing Java read projections; writes must supply version. */
        public Charter(String mission, String definitionOfDone, String primaryChannel, String coreHours,
                       String conflictResolution) {
            this(mission, definitionOfDone, primaryChannel, coreHours, conflictResolution, null);
        }
        public static Charter from(Team team) {
            return new Charter(team.getMission(), team.getDefinitionOfDone(), team.getPrimaryChannel(),
                    team.getCoreHours(), team.getConflictResolution());
        }

        public static Charter from(ProjectTeam team) {
            return new Charter(team.getMission(), team.getDefinitionOfDone(), team.getPrimaryChannel(),
                    team.getCoreHours(), team.getConflictResolution(), team.getVersion());
        }
    }
    public record ResponsibilityInput(@NotNull Long membershipId, @Size(max = 1000) String responsibility) { }
    public record CharterMember(Long membershipId, Long classMemberId, Long userId, String name, String email,
                                List<String> roles, String responsibility, boolean eligible, String issue,
                                boolean confirmed, java.time.Instant confirmedAt) { }
    public record CharterView(Long teamId, String teamName, String teamStatus, Long revision,
                              boolean canEdit, Charter charter, String rosterToken, List<CharterMember> members,
                              int confirmedCount, int memberCount, String progress, boolean canConfirm,
                              String confirmationBlockReason, String timeZone, boolean contentComplete,
                              String confirmationKind, java.time.Instant selfConfirmedAt) { }
    public record ConfirmCharter(@NotNull @PositiveOrZero Long version, @NotNull @Positive Long revision,
                                 @NotBlank @Size(max = 64) String rosterToken) { }
    public record CharterHistory(Long revision, Long actorId, java.time.Instant savedAt, Charter charter,
                                 List<CharterMember> members, List<CharterConsent> confirmations) { }
    public record CharterConsent(Long userId, String name, List<String> roles, String responsibility,
                                 java.time.Instant confirmedAt) { }
    public record TeamView(Long id, String code, String name, Long projectId, String projectName,
                           Long cohortId, String cohortName, Long mentorId, String mentorName,
                           List<Member> members, Charter charter) { }
}
