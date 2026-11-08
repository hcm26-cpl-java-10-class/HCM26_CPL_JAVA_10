package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectAssignmentService {
    private final ProjectAssignmentRepository assignments;
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository versions;
    private final ProjectTeamRepository teams;
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
        Long tenantId = session.getTrainingClass().getTenantId();
        String requestHash = hash(request);
        var previous = assignments.findByTenantIdAndClassIdAndIdempotencyKey(tenantId, classId, key);
        if (previous.isPresent()) return replay(previous.get(), sessionId, requestHash);
        var root = reader.load(request.masterTemplateId(), request.versionId(), tenantId);
        var selected = validation.validate(session, root, request, authentication);
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
        assignment.setCreatedBy(actorId);
        assignments.saveAndFlush(assignment);
        AssignmentDtos.Result result = writer.create(assignment, root, selected);
        try {
            String response = json.writeValueAsString(result);
            assignment.setResponseJson(response);
            assignments.saveAndFlush(assignment);
            String correlation = CorrelationIdFilter.currentId();
            audits.save(ProjectTeamAudit.builder().action("ASSIGN_PROJECT_HIERARCHY").actorId(actorId)
                    .classId(classId).allocationSessionId(sessionId).beforeState("null").afterState(response).correlationId(correlation).build());
            events.save(ProjectTeamOutboxEvent.builder().eventType("PROJECT_HIERARCHY_ASSIGNED").aggregateId(assignment.getId())
                    .payload(response).correlationId(correlation).status("PENDING").build());
            return result;
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to record the project assignment", exception);
        }
    }

    private AssignmentDtos.Result replay(ProjectAssignment previous, Long sessionId, String hash) {
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
