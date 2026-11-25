package com.example.starter_project_2025.system.project.charter;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos.*;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Shared transaction participant for Charter and official Allocation writers. Never writes on GET. */
@Service @RequiredArgsConstructor
public class TeamCharterIntegrity {
    private final ProjectMemberRepository members;
    private final TeamCharterResponsibilityRepository responsibilities;
    private final TeamCharterRevisionRepository revisions;
    private final ProjectTeamAuditRepository audits;
    private final ProjectTeamOutboxRepository outbox;
    private final ObjectMapper json;

    public record Roster(List<CharterMember> members, String token) { }
    private record Binding(Long membershipId, Long classMemberId, Long userId, String role, String responsibility,
                           boolean eligible, Object membershipUpdatedAt, Object classMemberUpdatedAt) { }
    private record RosterBinding(Long leaderMemberId, List<Binding> members) { }

    public Roster roster(ProjectTeam team) {
        Map<Long, String> duties = new HashMap<>();
        responsibilities.findByTeamId(team.getId()).forEach(r -> duties.put(r.getMembershipId(), r.getResponsibility()));
        List<CharterMember> result = new ArrayList<>();
        List<Binding> bindings = new ArrayList<>();
        for (ProjectMember row : members.findAllByTeam_IdOrderByIdAsc(team.getId())) {
            if (!Boolean.TRUE.equals(row.getIsActive())) continue;
            var cm = row.getClassMember();
            var user = cm.getUser();
            boolean ownTenant = user.getTenant() != null && Objects.equals(user.getTenant().getId(), team.getTrainingClass().getTenantId());
            boolean eligible = Boolean.TRUE.equals(cm.getIsActive()) && cm.getStatus() == ClassMemberStatus.ACTIVE
                    && Objects.equals(cm.getTrainingClass().getId(), team.getTrainingClass().getId()) && ownTenant
                    && Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked());
            boolean roleValid = ProjectMemberRole.isValidSpec(row.getRole()) && !ProjectMemberRole.parseRoles(row.getRole()).isEmpty();
            String duty = duties.getOrDefault(row.getId(), "");
            String issue = !eligible ? "Membership or account is inactive, locked or outside the class/tenant."
                    : !roleValid ? "Assign valid roles through Team Allocation." : duty.isBlank() ? "Responsibility has not been defined." : null;
            boolean ownClass = Objects.equals(cm.getTrainingClass().getId(), team.getTrainingClass().getId());
            result.add(new CharterMember(row.getId(), cm.getId(), user.getId(), ownTenant && ownClass ? user.getFullName() : "Unavailable member",
                    ownTenant && ownClass ? user.getEmail() : null, ProjectMemberRole.parseRoles(row.getRole()), duty, eligible, issue, false, null));
            // Include source timestamps: changing a role/status back must not resurrect an earlier consent.
            bindings.add(new Binding(row.getId(), cm.getId(), user.getId(), row.getRole(), duty, eligible,
                    row.getUpdatedAt() == null ? null : row.getUpdatedAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS),
                    cm.getUpdatedAt() == null ? null : cm.getUpdatedAt().truncatedTo(java.time.temporal.ChronoUnit.MICROS)));
        }
        return new Roster(List.copyOf(result), hash(encode(new RosterBinding(team.getLeaderMemberId(), bindings))));
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void rosterChanged(ProjectTeam team, Long actorId) {
        if (team.getStatus() != ProjectTeamStatus.ACTIVE || team.getCharterRevision() == 0) return;
        Roster roster = roster(team);
        if (Objects.equals(team.getCharterRosterToken(), roster.token())) return;
        record(team, actorId, "TEAM_CHARTER_ROSTER_CHANGED", roster, encode(Charter.from(team)));
    }

    @Transactional(propagation = org.springframework.transaction.annotation.Propagation.MANDATORY)
    public void record(ProjectTeam team, Long actorId, String event, Roster roster, String before) {
        team.setCharterRevision(team.getCharterRevision() + 1);
        team.setCharterRosterToken(roster.token());
        Instant now = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        var content = json.valueToTree(Charter.from(team));
        ((com.fasterxml.jackson.databind.node.ObjectNode) content).set("members", json.valueToTree(roster.members()));
        String snapshot = encode(content);
        String correlation = correlation();
        var saved = revisions.save(new TeamCharterRevision(team, team.getCharterRevision(), snapshot, actorId, now, correlation));
        // Keep large roster text in immutable evidence, not in the shared TEXT-sized audit/outbox or relay logs.
        effect(team, actorId, event, before, encode(Map.of("teamId", team.getId(), "revision", team.getCharterRevision(),
                "previousRevision", team.getCharterRevision() - 1, "snapshotId", saved.getId(), "snapshotHash", hash(snapshot),
                "rosterToken", roster.token(), "memberCount", roster.members().size())), correlation);
    }

    public void effect(ProjectTeam team, Long actorId, String event, String before, String after, String correlation) {
        audits.save(ProjectTeamAudit.builder().action("TEAM_CHARTER_UPDATED".equals(event) ? "UPDATE_TEAM_CHARTER" : event).actorId(actorId).classId(team.getTrainingClass().getId())
                .allocationSessionId(team.getAllocationSession().getId()).beforeState(before).afterState(after).correlationId(correlation).build());
        outbox.save(ProjectTeamOutboxEvent.builder().eventType(event).aggregateId(team.getId()).payload(after)
                .correlationId(correlation).status("PENDING").build());
    }

    public void recordDraftChange(ProjectTeam team, Long actorId, String before, String after) {
        effect(team, actorId, "TEAM_CHARTER_DRAFT_SAVED",
                encode(Map.of("draftHash", before == null ? "" : hash(before))),
                encode(Map.of("teamId", team.getId(), "revision", team.getCharterRevision(),
                        "draftHash", hash(after), "savedAt", Instant.now())), correlation());
    }

    public String correlation() {
        String id = CorrelationIdFilter.currentId();
        return "unknown".equals(id) ? UUID.randomUUID().toString() : id;
    }
    public String encode(Object value) {
        try { return json.writeValueAsString(value); }
        catch (com.fasterxml.jackson.core.JsonProcessingException e) { throw new IllegalStateException("Cannot serialize charter evidence", e); }
    }
    private String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
