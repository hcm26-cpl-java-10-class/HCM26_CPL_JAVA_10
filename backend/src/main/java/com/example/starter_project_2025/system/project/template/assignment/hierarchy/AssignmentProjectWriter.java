package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.cohort.CohortRepository;
import com.example.starter_project_2025.system.project.milestone.domain.*;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotRepository;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignment;
import com.example.starter_project_2025.system.project.resources.TeamSubprojectAssignmentRepository;
import com.example.starter_project_2025.system.project.resources.project_resources.ProjectResourceProvisioningService;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.*;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.domain.*;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceJournalService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
@RequiredArgsConstructor
public class AssignmentProjectWriter {
    private final ProjectRepository projects;
    private final ProjectTemplateRepository templates;
    private final ProjectTemplateSnapshotRepository snapshots;
    private final ProjectTeamRepository teams;
    private final TenantRepository tenants;
    private final MilestoneRepository milestones;
    private final RubricVersionRepository rubrics;
    private final SprintBacklogRepository backlog;
    private final WorkspaceRepository workspaces;
    private final WorkspaceProjectScope scope;
    private final TeamSubprojectAssignmentRepository mappings;
    private final AssignmentSnapshotService snapshotWriter;
    private final ProjectResourceProvisioningService resourceWriter;
    private final AssignmentTemplateReader templateReader;
    private final CohortRepository cohorts;
    private final com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository classes;
    private final WorkspaceJournalService journal;
    private final UserRepository users;

    public AssignmentDtos.Result create(ProjectAssignment assignment, AssignmentTemplateReader.Node master,
                                         AssignmentValidationService.Selection selection) {
        Map<Long, Project> created = new LinkedHashMap<>();
        createBranch(master, null, null, null, assignment, selection, created);
        Project root = created.get(master.templateId());
        assignment.setMasterProjectId(root.getId());
        List<AssignmentDtos.Workspace> result = new ArrayList<>();
        for (ProjectTeam team : selection.teams()) {
            AssignmentTemplateReader.Node primary = assignment.getMode() == AssignmentDtos.Mode.WHOLE ? master
                    : master.modules().stream().filter(node -> selection.owners().get(node.templateId()).getId().equals(team.getId()))
                    .findFirst().orElseThrow();
            Project project = created.get(primary.templateId());
            closePreviousWorkspace(team);
            team.setProject(project);
            team.setProjectTemplate(templates.findById(primary.templateId()).orElseThrow());
            team.setProjectTemplateVersionId(primary.sourceVersionId());
            team.setAssignedConstraintsJson(primary.content().path("constraints").toString());
            team.setAssignedTemplateName(primary.name());
            team.setMaxMembers(templateReader.capacity(primary).maxMembers());
            // Assignment must not publish the team: a DRAFT team stays DRAFT until it is
            // explicitly published, which is the only step that activates its project/workspace.
            teams.saveAndFlush(team);
            Workspace workspace = workspace(assignment, team, project);
            List<TeamSubprojectAssignment> assigned = new ArrayList<>();
            for (var entry : selection.owners().entrySet()) {
                if (!entry.getValue().getId().equals(team.getId())) continue;
                TeamSubprojectAssignment mapping = new TeamSubprojectAssignment();
                mapping.setProject(created.get(entry.getKey()));
                mapping.setTeam(team);
                mapping.setWorkspaceId(workspace.getId());
                assigned.add(mapping);
            }
            mappings.saveAllAndFlush(assigned);
            result.add(new AssignmentDtos.Workspace(workspace.getId(), team.getId(), team.getTeamName(),
                    project.getId(), project.getName()));
        }
        return new AssignmentDtos.Result(assignment.getId(), assignment.getMode(), root.getId(),
                assignment.getAssignedAt(), List.copyOf(result));
    }

    private void createBranch(AssignmentTemplateReader.Node node, Project parent, Long parentSnapshotId,
                              ProjectResourceProvisioningService.Source sharedResources, ProjectAssignment assignment,
                              AssignmentValidationService.Selection selection, Map<Long, Project> created) {
        ProjectTeam owner = selection.owners().get(node.templateId());
        if (owner == null && (parent != null || assignment.getMode() != AssignmentDtos.Mode.SPLIT))
            throw AssignmentException.invalid("Every module requires an assigned team");
        Long teamId = owner == null ? null : owner.getId();
        String origin = parent != null ? "SUB_PROJECT" : node.modules().isEmpty() ? "PROJECT" : "PARENT";
        var capture = snapshotWriter.capture(node, assignment, parentSnapshotId, teamId, origin);
        ProjectTemplateSnapshot snapshot = capture.snapshot();
        Project project = new Project();
        project.setTenant(tenants.findById(assignment.getTenantId()).orElseThrow());
        project.setClassId(assignment.getClassId());
        project.setTeamId(teamId);
        var trainingClass = classes.findById(assignment.getClassId()).orElseThrow();
        if (trainingClass.getCohortId() != null)
            project.setCohort(cohorts.findById(trainingClass.getCohortId()).orElse(null));
        project.setAssignmentId(assignment.getId());
        project.setCode("C" + assignment.getClassId() + "-A" + assignment.getId() + "-M" + node.templateId());
        project.setName(node.name());
        project.setDescription(shortText(node.content().path("description").asText(node.content().path("context").asText()), 2000));
        // A DRAFT team must not own an ACTIVE project yet; publishing the team activates it.
        project.setStatus(owner != null && owner.getStatus() == ProjectTeamStatus.DRAFT
                ? ProjectStatus.PLANNING
                : ProjectStatus.ACTIVE);
        project.setParentProject(parent);
        project.setTemplateSnapshotId(snapshot.getId());
        project.setCreatedBy(assignment.getCreatedBy());
        projects.saveAndFlush(project);
        snapshot.setProjectId(project.getId());
        snapshots.saveAndFlush(snapshot);
        created.put(node.templateId(), project);
        createMilestones(node, project, assignment);
        createBacklog(node, project);
        if (sharedResources != null) resourceWriter.provision(project, sharedResources);
        resourceWriter.provision(project, capture.source());
        var sharedForChildren = parent == null && assignment.getMode() == AssignmentDtos.Mode.SPLIT
                ? capture.source() : null;
        for (var child : node.modules())
            createBranch(child, project, snapshot.getId(), sharedForChildren, assignment, selection, created);
    }

    private void createMilestones(AssignmentTemplateReader.Node node, Project project, ProjectAssignment assignment) {
        UUID actor = UUID.nameUUIDFromBytes(("project-assignment:" + assignment.getCreatedBy()).getBytes(StandardCharsets.UTF_8));
        for (JsonNode item : node.content().path("milestones")) {
            Instant deadline = deadline(item, assignment.getAssignedAt());
            JsonNode late = item.path("latePolicy");
            boolean allowLate = late.path("allowLateSubmission").asBoolean();
            UUID rubricId = rubric(item, assignment.getTenantId());
            Milestone milestone = Milestone.create(assignment.getTenantId(), project.getId(), project.getTeamId(),
                    item.path("title").asText(), nullableText(item, "description"), deadline,
                    item.path("mandatory").asBoolean(true), rubricId, null,
                    allowLate ? LatePolicyType.ALLOW_LATE : LatePolicyType.NO_LATE,
                    allowLate ? deadline.plus(late.path("maxLateDays").asLong(), ChronoUnit.DAYS) : null,
                    allowLate ? late.path("penaltyPerDayPercent").decimalValue() : null, actor, assignment.getAssignedAt());
            milestone.configureAssessment(project.getParentProject() == null ? decimal(item, "weight") : BigDecimal.ZERO,
                    allowLate ? LatePenaltyBasis.PER_DAY : LatePenaltyBasis.FIXED);
            JsonNode checklist = item.has("checklistItems") ? item.path("checklistItems") : item.path("checklist");
            int order = 0;
            for (JsonNode check : checklist)
                milestone.addChecklistItem(check.path("content").asText(), check.path("mandatory").asBoolean(), order++);
            milestone.openForWork(actor, assignment.getAssignedAt());
            milestones.save(milestone);
        }
        milestones.flush();
    }

    private Instant deadline(JsonNode milestone, Instant assignedAt) {
        long offset = milestone.has("deadline_offset_days") ? milestone.path("deadline_offset_days").asLong(-1)
                : milestone.path("dueAfter").asLong(-1) * ("WEEKS".equals(milestone.path("dueUnit").asText()) ? 7 : 1);
        if (offset <= 0 || offset > 36500) throw AssignmentException.invalid("The saved milestone deadline offset is invalid");
        return assignedAt.plus(offset, ChronoUnit.DAYS);
    }

    private UUID rubric(JsonNode milestone, Long tenantId) {
        if (!milestone.path("rubricVersionId").isTextual())
            throw AssignmentException.invalid("Every assigned milestone requires a published rubric");
        UUID id;
        try { id = UUID.fromString(milestone.path("rubricVersionId").asText()); }
        catch (IllegalArgumentException exception) { throw AssignmentException.invalid("The saved rubric identifier is invalid"); }
        UUID legacyTenant = UUID.nameUUIDFromBytes(("tenant:" + tenantId).getBytes(StandardCharsets.UTF_8));
        var version = rubrics.findById(id).filter(value -> value.getStatus() != RubricVersionStatus.DRAFT
                && (value.getRubric().getTenantId().equals(RubricTenantIdentity.from(tenantId))
                    || value.getRubric().getTenantId().equals(legacyTenant)));
        if (version.isEmpty()) throw AssignmentException.invalid("The saved rubric is unavailable in this tenant");
        return id;
    }

    private void createBacklog(AssignmentTemplateReader.Node node, Project project) {
        List<SprintBacklog> copies = new ArrayList<>();
        for (JsonNode item : node.content().path("backlogItems")) {
            copies.add(SprintBacklog.builder().projectId(project.getId()).title(shortText(item.path("title").asText(), 200))
                    .description(nullableText(item, "description")).status(SprintBacklogStatus.TODO)
                    .workType(SprintBacklogWorkType.STORY).priority(SprintBacklogPriority.MEDIUM).isActive(true).version(0L).build());
        }
        backlog.saveAll(copies);
    }

    private void closePreviousWorkspace(ProjectTeam team) {
        workspaces.findCurrentByTeamId(team.getId()).ifPresent(previous -> {
            if (scope.projects(previous).stream().anyMatch(project -> !Set.of(ProjectStatus.COMPLETED, ProjectStatus.CANCELLED).contains(project.getStatus())))
                throw AssignmentException.busy(team.getTeamName());
            previous.setCurrentSlot(null);
            previous.setStatus(WorkspaceStatus.ARCHIVED);
            workspaces.saveAndFlush(previous);
        });
    }

    private Workspace workspace(ProjectAssignment assignment, ProjectTeam team, Project project) {
        Workspace workspace = new Workspace();
        workspace.setTeam(team);
        workspace.setTenant(project.getTenant());
        workspace.setProject(project);
        workspace.setCode("WS-A" + assignment.getId() + "-T" + team.getId());
        workspace.setName(shortText(project.getName() + " / " + team.getTeamName(), 255));
        // Only a published (ACTIVE) team gets an ACTIVE workspace.
        workspace.setStatus(team.getStatus() == ProjectTeamStatus.ACTIVE
                ? WorkspaceStatus.ACTIVE
                : WorkspaceStatus.DRAFT);
        workspace.setCreatedBy(assignment.getCreatedBy());
        workspace.setSections(new ArrayList<>(Arrays.asList(WorkspaceSection.values())));
        workspaces.saveAndFlush(workspace);
        journal.recordCreation(workspace, users.findById(assignment.getCreatedBy()).orElseThrow(),
                WorkspaceResponse.builder()
                        .id(workspace.getId()).tenantId(assignment.getTenantId()).teamId(team.getId()).projectId(project.getId())
                        .code(workspace.getCode()).name(workspace.getName()).status(workspace.getStatus())
                        .createdBy(assignment.getCreatedBy()).createdAt(workspace.getCreatedAt())
                        .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList()).build(),
                CorrelationIdFilter.currentId());
        return workspace;
    }

    private String nullableText(JsonNode node, String field) { return node.path(field).isTextual() ? node.path(field).asText() : null; }
    private BigDecimal decimal(JsonNode node, String field) { return node.path(field).isNumber() ? node.path(field).decimalValue() : null; }
    private String shortText(String value, int maximum) { return value.length() <= maximum ? value : value.substring(0, maximum); }
}
