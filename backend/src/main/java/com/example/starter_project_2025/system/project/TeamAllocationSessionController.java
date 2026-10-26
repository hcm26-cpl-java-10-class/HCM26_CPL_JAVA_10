package com.example.starter_project_2025.system.project;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/classes/{classId}/allocation-sessions")
public class TeamAllocationSessionController {

    private final TeamAllocationSessionService sessionService;
    private final ProjectTeamDraftCoordinator draftCoordinator;
    private final ProjectTeamQueryService teamQueryService;
    private final ProjectTeamPublishCoordinator publishCoordinator;
    private final ProjectTeamDraftService draftService;
    private final ProjectTeamMembershipService membershipService;
    private final ProjectTeamMentorService mentorService;
    private final ProjectTeamRoleService roleService;

    @GetMapping("/mentors")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    public java.util.List<MentorOptionResponse> getClassMentors(
            @PathVariable Long classId,
            Authentication authentication
    ) {
        return mentorService.getMentors(classId, authentication);
    }

    @GetMapping
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    public java.util.List<AllocationSessionResponse> getSessions(
            @PathVariable Long classId,
            Authentication authentication
    ) {
        return sessionService.getSessions(classId, authentication);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public AllocationSessionResponse openSession(
            @PathVariable Long classId,
            @Valid @RequestBody OpenAllocationSessionRequest request,
            Authentication authentication
    ) {
        return sessionService.openSession(classId, request, authentication);
    }

    @PatchMapping("/{sessionId}")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public AllocationSessionResponse updateSession(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @Valid @RequestBody UpdateAllocationSessionRequest request,
            Authentication authentication
    ) {
        return sessionService.updateMaxMembers(
                classId, sessionId, request, authentication);
    }

    @PostMapping("/{sessionId}/cancel")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public AllocationSessionResponse cancelSession(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            Authentication authentication
    ) {
        return sessionService.cancelSession(classId, sessionId, authentication);
    }

    @PostMapping("/{sessionId}/teams/batch")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public ResponseEntity<String> saveDraftBatch(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey,
            @RequestBody BatchSaveDraftRequest request,
            Authentication authentication
    ) {
        return draftCoordinator.saveBatch(
                classId, sessionId, idempotencyKey, request, authentication);
    }

    @GetMapping("/{sessionId}/teams")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    public BatchSaveDraftResponse getTeams(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            Authentication authentication
    ) {
        return teamQueryService.getTeams(classId, sessionId, authentication);
    }

    @PutMapping("/{sessionId}/teams/{teamId}/draft")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateDraftTeam(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @Valid @RequestBody UpdateDraftTeamRequest request,
            Authentication authentication
    ) {
        draftService.updateDraftTeam(
                classId, sessionId, teamId, request, authentication);
    }

    @PutMapping("/{sessionId}/teams/{teamId}/mentor")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateTeamMentor(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @Valid @RequestBody UpdateTeamMentorRequest request,
            Authentication authentication
    ) {
        mentorService.updateTeamMentor(
                classId, sessionId, teamId, request, authentication);
    }

    @PutMapping("/{sessionId}/teams/{teamId}/roles")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void updateTeamRoles(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @RequestBody UpdateTeamRolesRequest request,
            Authentication authentication
    ) {
        roleService.updateRoles(
                classId, sessionId, teamId, request, authentication);
    }

    @PostMapping("/{sessionId}/teams/{teamId}/members")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void addActiveTeamMember(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @Valid @RequestBody AddActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        membershipService.addMember(
                classId, sessionId, teamId, request, authentication);
    }

    @PostMapping("/{sessionId}/teams/{teamId}/members/{memberId}/transfer")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void transferActiveTeamMember(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @PathVariable Long memberId,
            @Valid @RequestBody TransferActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        membershipService.transferMember(
                classId, sessionId, teamId, memberId, request, authentication);
    }

    @DeleteMapping("/{sessionId}/teams/{teamId}/members/{memberId}")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void removeActiveTeamMember(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @PathVariable Long memberId,
            @Valid @RequestBody RemoveActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        membershipService.removeMember(
                classId, sessionId, teamId, memberId, request, authentication);
    }

    @PostMapping("/{sessionId}/teams/{teamId}/members/{memberId}/swap")
    @PreAuthorize("hasAnyAuthority('PEO_TEAM_ALLOCATE', 'PRJ_WORKSPACE_MANAGE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void swapActiveTeamMember(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @PathVariable Long teamId,
            @PathVariable Long memberId,
            @Valid @RequestBody SwapActiveTeamMemberRequest request,
            Authentication authentication
    ) {
        membershipService.swapMember(
                classId, sessionId, teamId, memberId, request, authentication);
    }

    @PostMapping("/{sessionId}/teams/publish")
    @PreAuthorize("hasAuthority('PEO_TEAM_ALLOCATE')")
    public ResponseEntity<String> publishTeams(
            @PathVariable Long classId,
            @PathVariable Long sessionId,
            @RequestHeader("X-Idempotency-Key") String idempotencyKey,
            @RequestBody PublishTeamsRequest request,
            Authentication authentication
    ) {
        return publishCoordinator.publish(
                classId, sessionId, idempotencyKey, request, authentication);
    }
}