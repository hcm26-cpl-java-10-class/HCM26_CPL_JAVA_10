package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AutoAllocationService {
    private final TeamAllocationSessionRepository sessions;
    private final ClassMemberRepository classMembers;
    private final ProjectMemberRepository projectMembers;
    private final ProjectTeamRepository teams;
    private final ScopeAuthorizationService authorization;
    private final ProjectTeamAuditRepository audits;
    private final ProjectTeamOutboxRepository outbox;
    private final ObjectMapper mapper;

    @Transactional(readOnly = true)
    public AutoAllocationPreview preview(Long classId, Long sessionId, Authentication actor) {
        TeamAllocationSession session = session(classId, sessionId, actor, false);
        List<ClassMember> eligible = eligible(session);
        ProjectTemplateConstraints.Capacity window = capacityWindow(session);
        if (eligible.isEmpty()) {
            throw new AutoAllocationException(HttpStatus.CONFLICT, "ERR_NO_ELIGIBLE_MEMBERS",
                    "Không còn học viên hợp lệ chưa có nhóm trong phiên này.");
        }
        int count = eligible.size();
        List<Integer> sizes = sizes(count, window);
        Collections.shuffle(eligible, new SecureRandom());
        List<AutoAllocationPreview.Team> result = new ArrayList<>();
        int offset = 0;
        for (int i = 0; i < sizes.size(); i++) {
            int size = sizes.get(i);
            List<AutoAllocationPreview.Member> members = eligible.subList(offset, offset + size)
                    .stream().map(member -> new AutoAllocationPreview.Member(member.getId(),
                            member.getUser().getFullName(), member.getUser().getUserCode())).toList();
            result.add(new AutoAllocationPreview.Team("Nhóm tự động " + (i + 1), members));
            offset += size;
        }
        return new AutoAllocationPreview(sessionId, window.maxMembers(), window.minMembers(), count,
                fingerprint(session, window, eligible), result);
    }

    @Transactional
    public BatchSaveDraftResponse confirm(Long classId, Long sessionId,
            AutoAllocationConfirmRequest request, Authentication actor) {
        TeamAllocationSession session = session(classId, sessionId, actor, true);
        List<Long> activeIds = classMembers.findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                classId, ClassMemberStatus.ACTIVE).stream().map(ClassMember::getId).toList();
        if (!activeIds.isEmpty()) {
            classMembers.findAllByIdInAndStatusForUpdate(classId, activeIds, ClassMemberStatus.ACTIVE);
        }
        List<ClassMember> eligible = eligible(session);
        ProjectTemplateConstraints.Capacity window = capacityWindow(session);
        if (request == null || request.teams() == null || request.teams().isEmpty()
                || request.fingerprint() == null
                || !request.fingerprint().equals(fingerprint(session, window, eligible))) {
            throw stale();
        }
        int max = window.maxMembers();
        int count = eligible.size();
        if (count == 0) throw stale();
        List<Integer> sizes = sizes(count, window);
        int groups = sizes.size();
        if (request.teams().size() != groups) throw stale();
        Map<Long, ClassMember> byId = eligible.stream().collect(Collectors.toMap(ClassMember::getId, Function.identity()));
        Set<Long> seen = new HashSet<>();
        List<Integer> actualSizes = new ArrayList<>();
        for (AutoAllocationConfirmRequest.Team draft : request.teams()) {
            if (draft == null || draft.teamName() == null || draft.teamName().isBlank()
                    || draft.teamName().length() > 255 || draft.memberIds() == null
                    || draft.memberIds().size() > max) {
                throw stale();
            }
            actualSizes.add(draft.memberIds().size());
            for (Long id : draft.memberIds()) if (!byId.containsKey(id) || !seen.add(id)) throw stale();
        }
        Collections.sort(actualSizes);
        List<Integer> expectedSizes = new ArrayList<>(sizes);
        Collections.sort(expectedSizes);
        if (seen.size() != count || !actualSizes.equals(expectedSizes)) throw stale();

        List<ProjectTeam> created = new ArrayList<>();
        for (AutoAllocationConfirmRequest.Team draft : request.teams()) {
            ProjectTeam team = ProjectTeam.builder().trainingClass(session.getTrainingClass())
                    .allocationSession(session).teamName(draft.teamName().trim())
                    .maxMembers(max).allocationSource(TeamAllocationSource.AUTO)
                    .status(ProjectTeamStatus.DRAFT).build();
            created.add(team);
        }
        teams.saveAllAndFlush(created);
        List<ProjectMember> assignments = new ArrayList<>();
        for (int i = 0; i < created.size(); i++) {
            ProjectTeam team = created.get(i);
            for (Long id : request.teams().get(i).memberIds()) {
                assignments.add(ProjectMember.builder().team(team).classMember(byId.get(id))
                        .role(ProjectMemberRole.DEV.name()).build());
            }
        }
        projectMembers.saveAllAndFlush(assignments);
        List<Map<String, Object>> snapshotTeams = java.util.stream.IntStream.range(0, created.size())
                .mapToObj(i -> Map.<String, Object>of(
                        "teamId", created.get(i).getId(),
                        "teamName", created.get(i).getTeamName(),
                        "memberIds", request.teams().get(i).memberIds()))
                .toList();
        String snapshot;
        try {
            snapshot = mapper.writeValueAsString(Map.of("sessionId", sessionId,
                    "classId", classId, "teams", snapshotTeams));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize allocation result", exception);
        }
        Long actorId = ((UserPrincipal) actor.getPrincipal()).getUser().getId();
        String correlation = java.util.UUID.randomUUID().toString();
        audits.save(ProjectTeamAudit.builder().action("AUTO_CREATE_DRAFT").actorId(actorId)
                .classId(classId).allocationSessionId(sessionId).afterState(snapshot)
                .correlationId(correlation).build());
        outbox.save(ProjectTeamOutboxEvent.builder().eventType("PROJECT_TEAM_DRAFT_CREATED")
                .aggregateId(sessionId).payload(snapshot).correlationId(correlation)
                .status("PENDING").build());
        List<BatchSaveDraftResponse.TeamResponse> responseTeams = new ArrayList<>();
        for (int i = 0; i < created.size(); i++) {
            ProjectTeam team = created.get(i);
            List<Long> ids = request.teams().get(i).memberIds();
            List<BatchSaveDraftResponse.MemberResponse> members = ids.stream().map(id -> {
                ClassMember member = byId.get(id);
                return new BatchSaveDraftResponse.MemberResponse(id, member.getUser().getFullName(),
                        member.getUser().getUserCode(), "DEV", List.of("DEV"));
            }).toList();
            responseTeams.add(new BatchSaveDraftResponse.TeamResponse(team.getId(), team.getTeamName(),
                    team.getStatus(), null, null, team.getVersion(), ids, members,
                    null, null, null, null, ids.size(), false, List.of(), null, team.getProjectId()));
        }
        return new BatchSaveDraftResponse("SUCCESS", sessionId, responseTeams, List.of());
    }

    private TeamAllocationSession session(Long classId, Long sessionId, Authentication actor, boolean lock) {
        TeamAllocationSession session = (lock ? sessions.findByIdForUpdate(sessionId) : sessions.findById(sessionId))
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException("TeamAllocationSession", "id", sessionId));
        authorization.assertCanManageClass(actor, session.getTrainingClass());
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) throw stale();
        return session;
    }

    private List<ClassMember> eligible(TeamAllocationSession session) {
        Long classId = session.getTrainingClass().getId();
        Set<Long> assigned = new HashSet<>(projectMembers.findAssignedMemberIdsBySessionAndTeamStatuses(
                session.getId(), List.of(ProjectTeamStatus.DRAFT, ProjectTeamStatus.ACTIVE)));
        return classMembers.findAllByTrainingClass_IdAndStatusOrderByIdAsc(classId, ClassMemberStatus.ACTIVE)
                .stream().filter(AllocationStudentEligibility::isEligible)
                .filter(member -> !assigned.contains(member.getId()))
                .collect(Collectors.toCollection(ArrayList::new));
    }

    /**
     * Team size window for auto allocation: the session capacity is the upper
     * bound (it may override the template), the template {@code min_members}
     * is the lower bound so generated teams pass the publish readiness check.
     */
    private ProjectTemplateConstraints.Capacity capacityWindow(TeamAllocationSession session) {
        Integer max = session.getMaxMembers();
        if (max == null || max <= 0 || max == Integer.MAX_VALUE) {
            throw new AutoAllocationException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "ERR_INVALID_TEAM_SIZE", "Số lượng thành viên/nhóm không hợp lệ.");
        }
        ProjectTemplate template = session.getProjectTemplate();
        int min = template == null || template.getConstraintsJson() == null
                || template.getConstraintsJson().isBlank()
                ? ProjectTemplateConstraints.DEFAULT_MIN_MEMBERS
                : ProjectTemplateConstraints.parse(mapper, template, max).minMembers();
        if (min > max) {
            throw new AutoAllocationException(HttpStatus.UNPROCESSABLE_ENTITY, "ERR_INVALID_TEAM_SIZE",
                    "Sĩ số tối đa của phiên (" + max + ") nhỏ hơn sĩ số tối thiểu của đề bài (" + min + ").");
        }
        return new ProjectTemplateConstraints.Capacity(min, max);
    }

    private List<Integer> sizes(int count, ProjectTemplateConstraints.Capacity window) {
        return AutoAllocationMath.teamSizes(count, window.minMembers(), window.maxMembers())
                .orElseThrow(() -> new AutoAllocationException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "ERR_ALLOCATION_INFEASIBLE",
                        "Không thể chia " + count + " học viên thành các nhóm " + window.window()
                                + " người. Hãy điều chỉnh sĩ số tối đa của phiên hoặc phân nhóm thủ công."));
    }

    private String fingerprint(TeamAllocationSession session, ProjectTemplateConstraints.Capacity window,
            List<ClassMember> members) {
        String existingTeams = teams.findAllByAllocationSession_IdOrderByIdAsc(session.getId()).stream()
                .map(team -> team.getId() + ":" + team.getVersion() + ":" + team.getStatus())
                .collect(Collectors.joining(","));
        String source = session.getId() + ":" + window.window() + ":" + members.stream()
                .map(member -> member.getId().toString()).sorted().collect(Collectors.joining(","))
                + ":" + existingTeams;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(source.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException(exception);
        }
    }

    private AutoAllocationException stale() {
        return new AutoAllocationException(HttpStatus.CONFLICT, "ERR_AUTO_ALLOCATION_STALE",
                "Dữ liệu phân nhóm đã thay đổi. Vui lòng tạo lại bản xem trước.");
    }
}
