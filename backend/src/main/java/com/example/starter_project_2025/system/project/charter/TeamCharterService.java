package com.example.starter_project_2025.system.project.charter;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos.*;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.spec.WorkspaceCandidateSpec;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.data.domain.*;
import java.time.Instant;
import java.util.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class TeamCharterService {
    private final ProjectTeamRepository teams;
    private final TenantRepository tenants;
    private final TeamAllocationSessionRepository sessions;
    private final TeamCharterRevisionRepository revisions;
    private final TeamCharterConfirmationRepository confirmations;
    private final TeamCharterResponsibilityRepository responsibilities;
    private final TeamCharterIntegrity integrity;
    private final ObjectMapper json;
    private final EntityManager entityManager;
    private final com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository workspaces;
    private static final Set<String> CHANNELS = Set.of("Microsoft Teams", "Slack", "Discord", "Google Chat", "Email");

    public List<CharterView> list() {
        requireRead(); var actor = principal(); requireTenant();
        return teams.findAll(WorkspaceCandidateSpec.forScope(actor.getUser().getId(), actor.getTenantId())
                .and((root, q, cb) -> cb.and(cb.isTrue(root.get("isActive")), cb.isTrue(root.get("trainingClass").get("isActive")),
                        root.get("status").in(ProjectTeamStatus.ACTIVE, ProjectTeamStatus.ARCHIVED))))
                .stream().sorted(Comparator.comparing(ProjectTeam::getTeamName).thenComparing(ProjectTeam::getId)).map(this::view).toList();
    }
    public CharterView get(Long teamId) { requireRead(); return view(scopedTeam(teamId)); }
    public CharterView getInWorkspace(Long teamId, Long workspaceId) {
        requireRead(); ProjectTeam team = scopedTeam(teamId);
        if (workspaceId != null && workspaces.findById(workspaceId).filter(w -> w.getTeam().getId().equals(teamId)).isEmpty())
            throw new ResourceNotFoundException("The workspace and team charter do not match");
        return view(team);
    }

    private CharterView view(ProjectTeam team) {
        var roster = integrity.roster(team);
        boolean current = Objects.equals(team.getCharterRosterToken(), roster.token());
        var consents = confirmations.findByTeamIdAndRevisionNumber(team.getId(), team.getCharterRevision());
        List<CharterMember> members = roster.members().stream().map(m -> {
            var consent = current && m.eligible() ? consents.stream().filter(c -> c.getUserId().equals(m.userId()) && c.getRosterToken().equals(roster.token())).findFirst() : Optional.<TeamCharterConfirmation>empty();
            return new CharterMember(m.membershipId(), m.classMemberId(), m.userId(), m.name(), m.email(), m.roles(), m.responsibility(), m.eligible(), m.issue(), consent.isPresent(), consent.map(TeamCharterConfirmation::getConfirmedAt).orElse(null));
        }).toList();
        int count = (int) members.stream().filter(CharterMember::confirmed).count();
        String block = blockReason(team, roster, current);
        var self = members.stream().filter(m -> m.userId().equals(principal().getUser().getId()) && m.eligible()).findFirst();
        if (block == null && self.isEmpty()) block = "Only an active member may confirm their own role and charter.";
        if (block == null && self.orElseThrow().confirmed()) block = "You have already confirmed this revision.";
        String progress = team.getCharterRevision() == 0 ? "NOT_SAVED" : !current || !complete(content(Charter.from(team))) || members.isEmpty() || members.stream().anyMatch(m -> m.issue() != null)
                ? "NEEDS_REVIEW" : !members.isEmpty() && count == members.size() ? "FULLY_CONFIRMED" : "PENDING";
        return new CharterView(team.getId(), team.getTeamName(), team.getStatus().name(), team.getCharterRevision(),
                canEdit(team, roster), Charter.from(team), roster.token(), members, count, members.size(), progress, block == null, block);
    }

    @Transactional
    public ProjectTeam save(Long teamId, Charter request) {
        ProjectTeam team = lockTeam(teamId); var roster = integrity.roster(team);
        requireActive(team);
        if (!canEdit(team, roster)) throw new AccessDeniedException("Only an authorized team editor or active Team Leader may edit the charter.");
        checkVersion(team, request.version());
        lockRoster(roster, team);
        Content before = content(Charter.from(team)); Content after = content(request);
        if (!after.primaryChannel().isEmpty() && !CHANNELS.contains(after.primaryChannel()) && !after.primaryChannel().equals(before.primaryChannel())) throw invalid("Select a supported primary channel.");
        boolean dutiesChanged = updateResponsibilities(team, roster, request.responsibilities());
        roster = integrity.roster(team);
        if (team.getCharterRevision() > 0 && before.equals(after) && !dutiesChanged && Objects.equals(team.getCharterRosterToken(), roster.token())) return team;
        team.setMission(after.mission()); team.setDefinitionOfDone(after.definitionOfDone()); team.setPrimaryChannel(after.primaryChannel());
        team.setCoreHours(after.coreHours()); team.setConflictResolution(after.conflictResolution());
        integrity.record(team, principal().getUser().getId(), "TEAM_CHARTER_UPDATED", roster, integrity.encode(before));
        return teams.saveAndFlush(team);
    }

    @Transactional
    public CharterView confirm(Long teamId, ConfirmCharter request) {
        requireRead(); ProjectTeam team = lockTeam(teamId); requireActive(team);
        var roster = integrity.roster(team);
        if (!Objects.equals(request.revision(), team.getCharterRevision()) || !Objects.equals(request.rosterToken(), roster.token())
                || !Objects.equals(team.getCharterRosterToken(), roster.token())) throw conflict("The charter or roster has changed. Reload the saved revision before confirming.");
        var self = roster.members().stream().filter(m -> m.userId().equals(principal().getUser().getId()) && m.eligible()).findFirst()
                .orElseThrow(() -> new AccessDeniedException("You may confirm only your own active team membership."));
        if (confirmations.findByTeamIdAndRevisionNumber(teamId, team.getCharterRevision()).stream().anyMatch(c -> c.getUserId().equals(self.userId()))) return view(team);
        checkVersion(team, request.version());
        String block = blockReason(team, roster, true); if (block != null) throw invalid(block);
        lockRoster(roster, team);
        String correlation = integrity.correlation(); Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        confirmations.saveAndFlush(new TeamCharterConfirmation(teamId, team.getCharterRevision(), self.userId(), roster.token(), integrity.encode(self), now, correlation));
        integrity.effect(team, self.userId(), "TEAM_CHARTER_CONFIRMED", null,
                integrity.encode(Map.of("teamId", teamId, "revision", team.getCharterRevision(), "userId", self.userId(), "confirmedAt", now)), correlation);
        return view(team);
    }

    public Page<CharterHistory> history(Long teamId, int page, int size) {
        requireRead(); scopedTeam(teamId);
        if (page < 0 || size < 1 || size > 50) throw invalid("History page must be non-negative and size must be between 1 and 50.");
        return revisions.findByTeam_IdOrderByRevisionNumberDesc(teamId, PageRequest.of(page, size)).map(r -> {
            try {
                var node = json.readTree(r.getContentJson());
                Charter charter = new Charter(node.path("mission").asText(""), node.path("definitionOfDone").asText(""), node.path("primaryChannel").asText(""), node.path("coreHours").asText(""), node.path("conflictResolution").asText(""));
                List<CharterMember> roster = node.has("members") ? json.convertValue(node.get("members"), new com.fasterxml.jackson.core.type.TypeReference<List<CharterMember>>() {}) : List.of();
                List<CharterConsent> consents = confirmations.findByTeamIdAndRevisionNumber(teamId, r.getRevisionNumber()).stream().map(c -> {
                    try { var member = json.readValue(c.getMemberSnapshot(), CharterMember.class); return new CharterConsent(c.getUserId(), member.name(), member.roles(), member.responsibility(), c.getConfirmedAt()); }
                    catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Cannot read charter consent evidence", e); }
                }).toList();
                return new CharterHistory(r.getRevisionNumber(), r.getActorId(), r.getSavedAt(), charter, roster, consents);
            } catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Cannot read charter history", e); }
        });
    }

    private boolean updateResponsibilities(ProjectTeam team, TeamCharterIntegrity.Roster roster, List<ResponsibilityInput> input) {
        if (input == null) return false;
        Map<Long, String> supplied = new HashMap<>();
        for (var entry : input) if (entry == null || entry.membershipId() == null || supplied.put(entry.membershipId(), normalize(entry.responsibility(), 1000)) != null) throw invalid("Provide each current member responsibility once.");
        Set<Long> ids = new HashSet<>(); roster.members().forEach(m -> ids.add(m.membershipId()));
        if (!ids.equals(supplied.keySet())) throw conflict("Team membership changed. Reload the charter before assigning responsibilities.");
        Map<Long, TeamCharterResponsibility> saved = new HashMap<>(); responsibilities.findByTeamId(team.getId()).forEach(r -> saved.put(r.getMembershipId(), r));
        boolean changed = false;
        for (var member : roster.members()) {
            String duty = supplied.get(member.membershipId()); if (Objects.equals(member.responsibility(), duty)) continue;
            var entity = saved.getOrDefault(member.membershipId(), new TeamCharterResponsibility());
            entity.setTeamId(team.getId()); entity.setMembershipId(member.membershipId()); entity.setResponsibility(duty); responsibilities.save(entity); changed = true;
        }
        responsibilities.flush(); return changed;
    }
    private String blockReason(ProjectTeam team, TeamCharterIntegrity.Roster roster, boolean current) {
        if (team.getStatus() != ProjectTeamStatus.ACTIVE) return "This team is read-only.";
        if (team.getCharterRevision() == 0) return "Save the charter before confirming.";
        if (!current) return "The roster changed. A team editor must save the updated charter before confirmation.";
        Content c = content(Charter.from(team));
        if (!complete(c)) return "Complete all five charter fields before confirmation.";
        if (roster.members().isEmpty()) return "The team has no active assignments to confirm.";
        if (roster.members().stream().anyMatch(m -> m.issue() != null)) return "Resolve the roster issues, roles and responsibilities shown below before confirmation.";
        return null;
    }
    private boolean canEdit(ProjectTeam team, TeamCharterIntegrity.Roster roster) {
        return team.getStatus() == ProjectTeamStatus.ACTIVE && (hasAuthority("TEAM_UPDATE") || (hasRead() && roster.members().stream()
                .anyMatch(m -> m.eligible() && m.userId().equals(principal().getUser().getId()) && team.isLedBy(m.classMemberId()))));
    }
    private ProjectTeam lockTeam(Long id) {
        ProjectTeam team = scopedTeam(id);
        sessions.findByIdForUpdate(team.getAllocationSession().getId()).orElseThrow(() -> new ResourceNotFoundException("Allocation session not found"));
        entityManager.refresh(team, LockModeType.PESSIMISTIC_WRITE); scopedTeam(id); return team;
    }
    private void lockRoster(TeamCharterIntegrity.Roster roster, ProjectTeam team) {
        for (var member : roster.members()) entityManager.refresh(entityManager.find(com.example.starter_project_2025.system.project.trainingclass.ClassMember.class, member.classMemberId()), LockModeType.PESSIMISTIC_READ);
        if (!Objects.equals(roster.token(), integrity.roster(team).token())) throw conflict("The class roster changed. Reload and try again.");
    }
    private void checkVersion(ProjectTeam team, Long version) {
        if (version == null || version < 0) throw invalid("version is required. Reload the charter before saving.");
        if (!Objects.equals(team.getVersion(), version)) throw conflict("The team or charter has changed. Reload and compare before saving.");
    }
    private void requireActive(ProjectTeam team) { if (team.getStatus() != ProjectTeamStatus.ACTIVE) throw conflict("This team is read-only. Charter changes require an active team."); }
    private ProjectTeam scopedTeam(Long id) {
        var actor = principal(); requireTenant();
        return teams.findOne(WorkspaceCandidateSpec.forScope(actor.getUser().getId(), actor.getTenantId()).and((root, q, cb) -> cb.and(
                cb.equal(root.get("id"), id), cb.isTrue(root.get("isActive")), cb.isTrue(root.get("trainingClass").get("isActive")),
                root.get("status").in(ProjectTeamStatus.ACTIVE, ProjectTeamStatus.ARCHIVED))))
                .orElseThrow(() -> new ResourceNotFoundException("Team charter was not found in your permitted scope"));
    }
    private void requireTenant() {
        var tenant = tenants.findById(principal().getTenantId()).orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) throw new AccessDeniedException("Tenant is inactive");
    }
    private UserPrincipal principal() {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof UserPrincipal actor) || actor.getTenantId() == null) throw new AccessDeniedException("Tenant context is not available");
        if (!Boolean.TRUE.equals(actor.getUser().getIsActive()) || Boolean.TRUE.equals(actor.getUser().getLocked())) throw new AccessDeniedException("Your account is not active or is locked");
        return actor;
    }
    private boolean hasAuthority(String value) { var auth = SecurityContextHolder.getContext().getAuthentication(); return auth != null && auth.getAuthorities().stream().anyMatch(a -> value.equals(a.getAuthority())); }
    private boolean hasRead() { return hasAuthority("TEAM_READ") || hasAuthority("WORKSPACE_READ") || hasAuthority("VIEW_PROJECT_WORKSPACE"); }
    private void requireRead() { principal(); if (!hasRead()) throw new AccessDeniedException("Missing charter read permission"); }
    private Content content(Charter c) { return new Content(normalize(c.mission(), 2000), normalize(c.definitionOfDone(), 2000), channel(c.primaryChannel()), normalize(c.coreHours(), 255), normalize(c.conflictResolution(), 2000)); }
    private boolean complete(Content c) { return !c.mission().isBlank() && !c.definitionOfDone().isBlank() && !c.primaryChannel().isBlank() && !c.coreHours().isBlank() && !c.conflictResolution().isBlank(); }
    private String channel(String value) { String result = normalize(value, 255); return "Teams".equals(result) ? "Microsoft Teams" : result; }
    private String normalize(String value, int max) { if (value != null && value.length() > max) throw invalid("Charter field exceeds its character limit."); return value == null ? "" : value.replace("\r\n", "\n").replace('\r', '\n').strip(); }
    private ResponseStatusException invalid(String message) { return new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, message); }
    private ResponseStatusException conflict(String message) { return new ResponseStatusException(HttpStatus.CONFLICT, message); }
    private record Content(String mission, String definitionOfDone, String primaryChannel, String coreHours, String conflictResolution) { }
}
