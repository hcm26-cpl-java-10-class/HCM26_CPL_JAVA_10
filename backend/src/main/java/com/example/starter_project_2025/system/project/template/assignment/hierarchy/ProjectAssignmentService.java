package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.Comparator;
import java.util.Collections;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectAssignmentService {
    private final ProjectAssignmentRepository assignments;
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTeamRepository teams;
    private final TrainingClassRepository classes;
    private final com.example.starter_project_2025.system.project.ProjectRepository projects;
    private final ProjectTeamAuditRepository audits;
    private final ProjectTeamOutboxRepository events;
    private final AssignmentValidationService validation;
    private final AssignmentTemplateReader reader;
    private final AssignmentProjectWriter writer;
    private final ObjectMapper json;
    private final Clock milestoneClock;

    public List<AssignmentDtos.ClassMaster> classMasters(Long classId, Long sessionId, Authentication authentication) {
        var session = validation.session(classId, sessionId, authentication, false);
        Long tenantId = session.getTrainingClass().getTenantId();
        return assignments.findAllByTenantIdAndClassIdAndSessionIdAndModeAndIsActiveTrueOrderByAssignedAtDesc(
                        tenantId, classId, sessionId, AssignmentDtos.Mode.SPLIT).stream()
                .filter(value -> value.getMasterProjectId() != null)
                .flatMap(value -> projects.findById(value.getMasterProjectId())
                        .filter(project -> tenantId.equals(project.getTenantId()) && Boolean.TRUE.equals(project.getIsActive()))
                        .map(project -> new AssignmentDtos.ClassMaster(project.getId(), project.getName(),
                                project.getStatus().name(), value.getAssignedAt())).stream()).toList();
    }

    public List<AssignmentDtos.Template> templates(Long classId, Long sessionId, String search, Authentication authentication) {
        var session = validation.session(classId, sessionId, authentication, false);
        Long tenantId = session.getTrainingClass().getTenantId();
        String keyword = search == null ? "" : search.strip().toLowerCase(java.util.Locale.ROOT);
        return templates.findAll().stream()
                .filter(template -> tenantId.equals(template.getTenantId()) && Boolean.TRUE.equals(template.getIsActive())
                        && template.getParentTemplateId() == null && template.getStatus() == ProjectTemplateStatus.ACTIVE)
                .filter(template -> keyword.isEmpty() || (template.getCode() + " " + template.getName()).toLowerCase(java.util.Locale.ROOT).contains(keyword))
                .sorted(Comparator.comparing(ProjectTemplate::getName)).limit(100)
                .flatMap(template -> versions.findFirstByTemplateIdAndStatusAndIsActiveTrueOrderByCreatedAtDesc(
                        template.getId(), ProjectTemplateVersionStatus.PUBLISHED).stream()
                        .filter(version -> version.getProjectId() == null)
                        .map(version -> new AssignmentDtos.Template(template.getId(), version.getId(), version.getVersion(), template.getCode(), template.getName())))
                .toList();
    }

    public AssignmentDtos.Preview preview(Long classId, Long sessionId, Long templateId, Long versionId, Authentication authentication) {
        var session = validation.session(classId, sessionId, authentication, false);
        var root = reader.load(templateId, versionId, session.getTrainingClass().getTenantId());
        var capacity = reader.capacity(root);
        List<AssignmentDtos.Team> available = teams.findAllByAllocationSession_IdOrderByIdAsc(sessionId).stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()))
                .map(team -> {
                    String reason = validation.unavailableReason(team);
                    var activeMembers = validation.activeMembers(team);
                    var roster = activeMembers.stream().map(member -> new AssignmentDtos.Member(
                            member.getClassMember().getId(), member.getClassMember().getUser().getFullName(),
                            member.getClassMember().getUser().getUserCode(), ProjectMemberRole.parseRoles(member.getRole()))).toList();
                    return new AssignmentDtos.Team(team.getId(), team.getTeamName(), roster.size(),
                            team.getStatus().name(), reason == null, "unfinished".equals(reason) ? "This team already has unfinished project work" : reason,
                            team.getVersion(), roster, ProjectTeamLeaderService.activeLeaderId(team, activeMembers));
                }).toList();
        return new AssignmentDtos.Preview(new AssignmentDtos.Template(root.templateId(), root.sourceVersionId(), root.version(), root.code(), root.name()),
                capacity.minMembers(), capacity.maxMembers(), root.content().path("milestones").size(),
                root.modules().stream().map(this::module).toList(), available, reader.roles(root));
    }

    private AssignmentDtos.Module module(AssignmentTemplateReader.Node node) {
        var capacity = reader.capacity(node);
        return new AssignmentDtos.Module(node.templateId(), node.code(), node.name(), capacity.minMembers(), capacity.maxMembers(),
                node.content().path("milestones").size(), node.modules().stream().map(this::module).toList(), reader.roles(node));
    }

    @Transactional
    public AssignmentDtos.Result assign(Long classId, Long sessionId, String key, AssignmentDtos.Request request, Authentication authentication) {
        if (key == null || key.isBlank() || key.length() > 100)
            throw AssignmentException.invalid("Provide a request key of 1 to 100 characters");
        var session = validation.session(classId, sessionId, authentication, true);
        // Module ownership is shared by all allocation sessions of the class.
        classes.findByIdForUpdate(classId).orElseThrow();
        Long tenantId = session.getTrainingClass().getTenantId();
        String requestHash = hash(request);
        var previous = assignments.findByTenantIdAndClassIdAndIdempotencyKey(tenantId, classId, key);
        if (previous.isPresent()) return replay(previous.get(), sessionId, requestHash);
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN)
            throw AssignmentException.invalid("Chỉ lưu phân công trong phiên đang mở.");
        var root = reader.load(request.masterTemplateId(), request.versionId(), tenantId);
        var selected = validation.validate(session, root, request, authentication);
        replacePending(sessionId, request);
        requireUnassignedModules(tenantId, classId, root, null);
        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        ProjectAssignment assignment = new ProjectAssignment();
        assignment.setTenantId(tenantId);
        assignment.setClassId(classId);
        assignment.setSessionId(sessionId);
        assignment.setMode(request.mode());
        assignment.setSourceVersionId(root.sourceVersionId());
        assignment.setAssignedAt(milestoneClock.instant());
        assignment.setIdempotencyKey(key);
        assignment.setRequestHash(requestHash);
        assignment.setRequestJson(write(request));
        assignment.setCreatedBy(actorId);
        assignments.saveAndFlush(assignment);
        writer.prepare(selected);
        AssignmentDtos.Result result = new AssignmentDtos.Result(assignment.getId(), assignment.getMode(), null,
                assignment.getAssignedAt(), List.of());
        String response = write(result);
        assignment.setResponseJson(response);
        assignments.saveAndFlush(assignment);
        audits.save(ProjectTeamAudit.builder().action("ASSIGN_PROJECT_HIERARCHY").actorId(actorId)
                .classId(classId).allocationSessionId(sessionId).beforeState("null").afterState(response)
                .correlationId(CorrelationIdFilter.currentId()).build());
        return result;
    }

    public boolean hasPending(Long sessionId) {
        return !assignments.findAllBySessionIdAndMasterProjectIdIsNullAndIsActiveTrueOrderByIdAsc(sessionId).isEmpty();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void publishPending(TeamAllocationSession session, Authentication authentication) {
        var pending = assignments.findAllBySessionIdAndMasterProjectIdIsNullAndIsActiveTrueOrderByIdAsc(session.getId());
        if (pending.isEmpty()) return;
        classes.findByIdForUpdate(session.getTrainingClass().getId()).orElseThrow();
        for (var assignment : pending) {
            var saved = savedRequest(assignment);
            if (!hasAssignedTeams(session.getId(), saved)) {
                assignment.setIsActive(false);
                continue;
            }
            var request = new AssignmentDtos.Request(saved.masterTemplateId(), saved.versionId(), saved.mode(),
                    saved.teamId(), saved.modules());
            var root = reader.loadAssigned(request.masterTemplateId(), request.versionId(), assignment.getTenantId());
            requireUnassignedModules(assignment.getTenantId(), assignment.getClassId(), root, assignment.getId());
            var selection = validation.validate(session, root, request, authentication);
            for (var brief : selection.briefs()) {
                var team = brief.team();
                var primary = brief.primary();
                if (!primary.templateId().equals(team.getProjectTemplateId())
                        || !primary.sourceVersionId().equals(team.getProjectTemplateVersionId()))
                    throw AssignmentException.invalid("Phân công của " + team.getTeamName()
                            + " đã thay đổi. Lưu lại toàn bộ phân công Master trước khi công bố.");
            }
            assignment.setAssignedAt(milestoneClock.instant());
            var result = writer.create(assignment, root, selection);
            assignment.setResponseJson(write(result));
            assignments.saveAndFlush(assignment);
            String correlation = CorrelationIdFilter.currentId();
            events.save(ProjectTeamOutboxEvent.builder().eventType("PROJECT_HIERARCHY_ASSIGNED").aggregateId(assignment.getId())
                    .payload(assignment.getResponseJson()).correlationId(correlation).status("PENDING").build());
        }
    }

    private void replacePending(Long sessionId, AssignmentDtos.Request request) {
        Set<Long> selectedIds = teamIds(request);
        for (var previous : assignments.findAllBySessionIdAndMasterProjectIdIsNullAndIsActiveTrueOrderByIdAsc(sessionId)) {
            var saved = savedRequest(previous);
            Set<Long> previousIds = teamIds(saved);
            boolean editingSplit = request.mode() == AssignmentDtos.Mode.SPLIT && saved.mode() == AssignmentDtos.Mode.SPLIT
                    && request.masterTemplateId().equals(saved.masterTemplateId());
            if (!editingSplit && Collections.disjoint(previousIds, selectedIds)) continue;
            if (!editingSplit && !selectedIds.containsAll(previousIds)) {
                throw AssignmentException.invalid("Team thuộc một phân công Master chung. Chỉnh phân công ở màn của cả lớp.");
            }
            previous.setIsActive(false);
            for (Long teamId : previousIds.stream().sorted().toList()) {
                if (selectedIds.contains(teamId)) continue;
                var team = teams.findForWorkspaceCreation(teamId).orElse(null);
                if (team == null || !Boolean.TRUE.equals(team.getIsActive()) || team.getStatus() == ProjectTeamStatus.ARCHIVED) continue;
                if (team.getStatus() != ProjectTeamStatus.DRAFT || team.getProjectId() != null)
                    throw AssignmentException.invalid("Phân công Master đã có Team được công bố.");
                if (isBoundTo(saved, team)) {
                    team.setProjectTemplate(null);
                    team.setProjectTemplateVersionId(null);
                    team.setAssignedConstraintsJson(null);
                    team.setAssignedTemplateName(null);
                    teams.saveAndFlush(team);
                }
            }
        }
    }

    private Set<Long> teamIds(AssignmentDtos.Request request) {
        if (request.mode() == AssignmentDtos.Mode.WHOLE) return Set.of(request.teamId());
        Set<Long> ids = new HashSet<>();
        request.modules().forEach(module -> ids.add(module.teamId()));
        return ids;
    }

    private boolean isBoundTo(AssignmentDtos.Request request, ProjectTeam team) {
        if (request.mode() == AssignmentDtos.Mode.WHOLE)
            return request.masterTemplateId().equals(team.getProjectTemplateId());
        return request.modules().stream().anyMatch(module -> module.teamId().equals(team.getId())
                && module.moduleTemplateId().equals(team.getProjectTemplateId()));
    }

    private boolean hasAssignedTeams(Long sessionId, AssignmentDtos.Request request) {
        return teamIds(request).stream().anyMatch(id -> teams.findByIdAndAllocationSession_Id(id, sessionId)
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() != ProjectTeamStatus.ARCHIVED)
                .isPresent());
    }

    private void requireUnassignedModules(Long tenantId, Long classId, AssignmentTemplateReader.Node root, Long publishingId) {
        if (root.modules().isEmpty()) return;
        Set<Long> currentModules = new HashSet<>();
        collectModuleIds(root, currentModules);
        for (var other : assignments.findActiveForMaster(tenantId, classId, root.templateId(), TeamAllocationSessionStatus.CANCELLED)) {
            if (Objects.equals(publishingId, other.getId())) continue;
            if (other.getMasterProjectId() == null && !hasAssignedTeams(other.getSessionId(), savedRequest(other))) continue;
            boolean overlap = other.getSourceVersionId().equals(root.sourceVersionId());
            if (!overlap) {
                var previous = reader.loadAssigned(root.templateId(), other.getSourceVersionId(), tenantId);
                Set<Long> previousModules = new HashSet<>();
                collectModuleIds(previous, previousModules);
                overlap = !Collections.disjoint(currentModules, previousModules);
            }
            if (overlap) {
                throw new AssignmentException(HttpStatus.CONFLICT, "PROJECT_ASSIGNMENT_MODULE_ALREADY_ASSIGNED",
                        "Module của Master này đã có Team phụ trách trong lớp. Mỗi module chỉ được giao cho một Team.");
            }
        }
    }

    private void collectModuleIds(AssignmentTemplateReader.Node parent, Set<Long> ids) {
        for (var module : parent.modules()) {
            ids.add(module.templateId());
            collectModuleIds(module, ids);
        }
    }

    private AssignmentDtos.Request savedRequest(ProjectAssignment assignment) {
        try { return json.readValue(assignment.getRequestJson(), AssignmentDtos.Request.class); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("The saved assignment is invalid", exception); }
    }

    private String write(Object value) {
        try { return json.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("Unable to save the assignment", exception); }
    }

    private AssignmentDtos.Result replay(ProjectAssignment previous, Long sessionId, String hash) {
        if (!Boolean.TRUE.equals(previous.getIsActive()))
            throw AssignmentException.invalid("Phân công này đã được thay thế. Tải lại dữ liệu phân công.");
        if (!previous.getSessionId().equals(sessionId) || !previous.getRequestHash().equals(hash))
            throw new AssignmentException(HttpStatus.CONFLICT, "PROJECT_ASSIGNMENT_REQUEST_REUSED",
                    "This request key was already used for a different assignment");
        try { return json.readValue(previous.getResponseJson(), AssignmentDtos.Result.class); }
        catch (JsonProcessingException exception) { throw new IllegalStateException("The saved assignment result is invalid", exception); }
    }

    private String hash(AssignmentDtos.Request request) {
        try {
            byte[] bytes = json.writeValueAsString(request).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to identify the assignment request", exception);
        }
    }
}
