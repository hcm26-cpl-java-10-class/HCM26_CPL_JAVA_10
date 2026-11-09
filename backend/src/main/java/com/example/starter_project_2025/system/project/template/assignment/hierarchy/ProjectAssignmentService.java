package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.project_template_version.*;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
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
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
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
        Set<Long> templateIds = root.templateIds();
        List<AssignmentDtos.Team> available = teams.findAllByAllocationSession_IdOrderByIdAsc(sessionId).stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()))
                .map(team -> {
                    String reason = validation.unavailableReason(team, templateIds);
                    var activeMembers = validation.activeMembers(team);
                    var roster = activeMembers.stream().map(member -> new AssignmentDtos.Member(
                            member.getClassMember().getId(), member.getClassMember().getUser().getFullName(),
                            member.getClassMember().getUser().getUserCode(), ProjectMemberRole.parseRoles(member.getRole()))).toList();
                    return new AssignmentDtos.Team(team.getId(), team.getTeamName(), roster.size(),
                            team.getStatus().name(), reason == null, "unfinished".equals(reason) ? "Đang thực hiện Project." : reason,
                            team.getVersion(), roster, ProjectTeamLeaderService.activeLeaderId(team, activeMembers),
                            team.getProject() != null ? team.getProject().getName() : team.getProjectTemplateName());
                }).toList();
        return new AssignmentDtos.Preview(new AssignmentDtos.Template(root.templateId(), root.sourceVersionId(), root.version(), root.code(), root.name()),
                capacity.minMembers(), capacity.maxMembers(), root.content().path("milestones").size(),
                root.modules().stream().map(this::module).toList(), available, reader.roles(root),
                currentOwners(session.getTrainingClass(), root.templateId(), templateIds));
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
        requireMatchingOwners(session.getTrainingClass(), root, selected);
        replacePending(sessionId, request);
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
            var selection = validation.validate(session, root, request, authentication);
            requireMatchingOwners(session.getTrainingClass(), root, selection);
            for (var brief : selection.briefs()) {
                var team = brief.team();
                var primary = brief.primary();
                if (!primary.templateId().equals(team.getProjectTemplateId())
                        || !primary.sourceVersionId().equals(team.getProjectTemplateVersionId()))
                    throw AssignmentException.invalid("Phân công của " + team.getTeamName()
                            + " đã thay đổi. Lưu lại toàn bộ phân công Master trước khi công bố.");
            }
            assignment.setAssignedAt(milestoneClock.instant());
            var result = writer.createForPublication(assignment, root, selection);
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

    @Transactional(propagation = Propagation.MANDATORY)
    public void validateDirectTemplateAssignment(ProjectTeam team, ProjectTemplate template, Long versionId) {
        classes.findByIdForUpdate(team.getTrainingClass().getId()).orElseThrow();
        if (isInPendingHierarchy(team)) {
            throw AssignmentException.invalid("Team đã có phân công Master. Chỉnh đề bài ở màn gán của lớp.");
        }
        String conflict = directAssignmentConflict(team, template, versionId);
        if (conflict != null) throw AssignmentException.moduleAlreadyAssigned(conflict);
    }

    public String directAssignmentPublishIssue(ProjectTeam team) {
        if (!hasDirectTemplate(team) || isInPendingHierarchy(team)) return null;
        return directAssignmentConflict(team, team.getProjectTemplate(), team.getProjectTemplateVersionId());
    }

    @Transactional(propagation = Propagation.MANDATORY, noRollbackFor = TeamPublishValidationException.class)
    public void validateDirectAssignmentPublication(ProjectTeam team) {
        if (!hasDirectTemplate(team)) return;
        classes.findByIdForUpdate(team.getTrainingClass().getId()).orElseThrow();
        String conflict = directAssignmentPublishIssue(team);
        if (conflict != null) throw new TeamPublishValidationException(conflict);
    }

    private boolean hasDirectTemplate(ProjectTeam team) {
        return team.getProjectTemplate() != null
                && (team.getProject() == null || team.getProject().getAssignmentId() == null);
    }

    private boolean isInPendingHierarchy(ProjectTeam team) {
        return assignments.findAllBySessionIdAndMasterProjectIdIsNullAndIsActiveTrueOrderByIdAsc(
                        team.getAllocationSession().getId()).stream()
                .anyMatch(assignment -> teamIds(savedRequest(assignment)).contains(team.getId()));
    }

    private String directAssignmentConflict(ProjectTeam team, ProjectTemplate template, Long versionId) {
        TrainingClass trainingClass = team.getTrainingClass();
        Long masterId = masterTemplateId(template);
        Set<Long> ids = new LinkedHashSet<>();
        ids.add(template.getId());
        ids.add(masterId);
        if (template.getParentTemplateId() == null && template.getTenantId() != null && versionId != null) {
            ids.addAll(reader.loadAssigned(template.getId(), versionId, trainingClass.getTenantId()).templateIds());
        }
        return currentOwners(trainingClass, masterId, ids).stream()
                .filter(owner -> !team.getId().equals(owner.teamId()))
                .map(this::ownerConflictMessage)
                .findFirst().orElse(null);
    }

    private Long masterTemplateId(ProjectTemplate template) {
        Set<Long> visited = new HashSet<>();
        ProjectTemplate current = template;
        while (current.getParentTemplateId() != null) {
            if (!visited.add(current.getId())) {
                throw AssignmentException.invalid("Cây module của đề bài không hợp lệ.");
            }
            current = templates.findById(current.getParentTemplateId())
                    .orElseThrow(() -> AssignmentException.invalid("Không tìm thấy Master của module."));
        }
        return current.getId();
    }

    private void requireMatchingOwners(TrainingClass trainingClass, AssignmentTemplateReader.Node root,
                                       AssignmentValidationService.Selection selection) {
        for (var owner : currentOwners(trainingClass, root.templateId(), root.templateIds())) {
            ProjectTeam proposed = selection.owners().get(owner.templateId());
            // Split projects have no single master owner. An existing master owner applies to each module.
            boolean matches = proposed == null
                    ? selection.briefs().stream().allMatch(brief -> owner.teamId().equals(brief.team().getId()))
                    : owner.teamId().equals(proposed.getId());
            if (!matches) throw AssignmentException.moduleAlreadyAssigned(ownerConflictMessage(owner));
        }
    }

    private List<AssignmentDtos.Owner> currentOwners(TrainingClass trainingClass, Long masterId, Set<Long> ids) {
        Long classId = trainingClass.getId();
        Long tenantId = trainingClass.getTenantId();
        var cancelled = TeamAllocationSessionStatus.CANCELLED;
        Map<Long, Set<Long>> owners = new LinkedHashMap<>();
        teams.findTemplateBindings(classId, ids).forEach(team -> addOwner(owners, team.getProjectTemplateId(), team.getId()));
        assignments.findPublishedOwners(tenantId, classId, ids, cancelled)
                .forEach(owner -> addOwner(owners, owner.getTemplateId(), owner.getTeamId()));
        for (var assignment : assignments.findPendingForMaster(tenantId, classId, masterId, cancelled)) {
            collectDraftOwners(assignment, masterId, owners);
        }
        Set<Long> ownerIds = new HashSet<>();
        owners.values().forEach(ownerIds::addAll);
        Map<Long, String> names = new LinkedHashMap<>();
        teams.findAllById(ownerIds).forEach(team -> names.put(team.getId(), team.getTeamName()));
        return owners.entrySet().stream().filter(entry -> ids.contains(entry.getKey()))
                .flatMap(entry -> entry.getValue().stream().map(teamId -> new AssignmentDtos.Owner(
                        entry.getKey(), teamId, names.getOrDefault(teamId, "Team #" + teamId)))).toList();
    }

    private void collectDraftOwners(ProjectAssignment assignment, Long masterId, Map<Long, Set<Long>> owners) {
        var request = savedRequest(assignment);
        Set<Long> activeTeams = new HashSet<>();
        for (var team : teams.findAllById(teamIds(request))) {
            if (Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() != ProjectTeamStatus.ARCHIVED
                    && team.getAllocationSession().getId().equals(assignment.getSessionId())) {
                activeTeams.add(team.getId());
            }
        }
        if (activeTeams.isEmpty()) return;
        var root = reader.loadAssigned(masterId, assignment.getSourceVersionId(), assignment.getTenantId());
        if (request.mode() == AssignmentDtos.Mode.WHOLE) {
            if (activeTeams.contains(request.teamId())) {
                root.templateIds().forEach(id -> addOwner(owners, id, request.teamId()));
            }
            return;
        }
        Map<Long, Long> byModule = new LinkedHashMap<>();
        request.modules().forEach(module -> byModule.put(module.moduleTemplateId(), module.teamId()));
        for (var branch : root.modules()) {
            Long teamId = byModule.get(branch.templateId());
            if (activeTeams.contains(teamId)) branch.templateIds().forEach(id -> addOwner(owners, id, teamId));
        }
    }

    private void addOwner(Map<Long, Set<Long>> owners, Long templateId, Long teamId) {
        owners.computeIfAbsent(templateId, ignored -> new LinkedHashSet<>()).add(teamId);
    }

    private String ownerConflictMessage(AssignmentDtos.Owner owner) {
        String name = templates.findById(owner.templateId()).map(ProjectTemplate::getName).orElse("#" + owner.templateId());
        return "“" + name + "” đã được giao cho “" + owner.teamName() + "” trong lớp này.";
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
