package com.example.starter_project_2025.system.project.template.assignment;

import com.example.starter_project_2025.system.project.ProjectMember;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamAudit;
import com.example.starter_project_2025.system.project.ProjectTeamAuditRepository;
import com.example.starter_project_2025.system.project.ProjectTeamOutboxEvent;
import com.example.starter_project_2025.system.project.ProjectTeamOutboxRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.cohort.CohortRepository;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.domain.LatePenaltyBasis;
import com.example.starter_project_2025.system.project.milestone.domain.LatePolicyType;
import com.example.starter_project_2025.system.project.milestone.domain.Milestone;
import com.example.starter_project_2025.system.project.milestone.repository.MilestoneRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshot;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneChecklistItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestonePlanRequest;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRubrics;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneScheduleValidator;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneValidator;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceActivity;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceResponse;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceActivityRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceJournalService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateAssignmentProvisioningService {

    public static final String AUDIT_ACTION = "PROVISION_TEAM_PROJECT";
    public static final String OUTBOX_EVENT = "TEAM_PROJECT_PROVISIONED";
    public static final String ACTIVITY_WORKSPACE_GENERATED = "WORKSPACE_COMPONENTS_GENERATED";

    private static final int PROJECT_CODE_MAX = 100;

    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository projectMembers;
    private final ProjectTeamAuditRepository audits;
    private final ProjectTeamOutboxRepository outbox;
    private final TenantRepository tenants;
    private final CohortRepository cohorts;
    private final WorkspaceRepository workspaces;
    private final WorkspaceActivityRepository activities;
    private final WorkspaceJournalService workspaceJournal;
    private final UserRepository users;
    private final MilestoneRepository milestones;
    private final SprintBacklogRepository sprintBacklog;
    private final TemplateMilestoneRepository templateMilestones;
    private final TemplateBacklogItemRepository templateBacklogItems;
    private final TemplateMilestoneValidator milestoneValidator;
    private final TemplateMilestoneScheduleValidator scheduleValidator;
    private final TemplateMilestoneRubrics milestoneRubrics;
    private final TemplateBriefSnapshotWriter briefSnapshots;
    private final ObjectMapper objectMapper;

    @Transactional(propagation = Propagation.MANDATORY)
    public void provision(ProjectTeam team, ProjectTemplate template, Long actorId, String correlationId) {

        if (team.getProjectId() != null) {
            log.debug("US-13 team {} already owns project {} - provisioning skipped",
                    team.getId(), team.getProjectId());
            return;
        }

        Long tenantId = Objects.requireNonNull(team.getTrainingClass().getTenantId(),
                "The training class must belong to a tenant");
        if (template.getStatus() != ProjectTemplateStatus.ACTIVE || !Boolean.TRUE.equals(template.getIsActive())
                || template.getTenantId() != null && !tenantId.equals(template.getTenantId())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "Select an active project template available to this team before creating its workspace");
        }
        Instant now = Instant.now();
        List<TemplateMilestone> milestonePlan =
                templateMilestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        var planRequest = TemplateMilestonePlanRequest.from(template.getLockVersion(), milestonePlan);
        milestoneValidator.validate(planRequest);
        scheduleValidator.validate(planRequest, template.getEstimatedDurationWeeks());
        milestoneRubrics.requirePublished(planRequest, tenantId);

        // ---- Step 1: immutable evidence snapshot of the active brief version
        ProjectTemplateSnapshot snapshot = briefSnapshots.snapshotForAssignment(template, team.getId());

        // ---- Step 2: project creation
        Project project = createProject(team, template, snapshot, tenantId, actorId);
        briefSnapshots.linkProject(snapshot, project.getId());

        team.setProject(project);
        teams.saveAndFlush(team);

        // ---- Step 3: workspace + generated components
        Workspace workspace = ensureWorkspace(team, project, tenantId, actorId, correlationId);

        int generatedMilestones = generateMilestones(
                team, project, tenantId, actorId, now, milestonePlan);
        int generatedBacklogItems = generateSampleBacklog(project, template);

        recordActivity(workspace, tenantId, actorId, correlationId, ACTIVITY_WORKSPACE_GENERATED);

        recordProvisioning(team, project, template, snapshot, workspace,
                generatedMilestones, generatedBacklogItems, actorId, correlationId);
    }

    // ------------------------------------------------------------------
    // Step 2 — Project
    // ------------------------------------------------------------------

    private Project createProject(ProjectTeam team,
                                  ProjectTemplate template,
                                  ProjectTemplateSnapshot snapshot,
                                  Long tenantId,
                                  Long actorId) {

        String code = uniqueProjectCode(team, tenantId);

        Project project = new Project();
        project.setCode(code);
        project.setName(resolveProjectName(team, template));
        project.setDescription(template.getDescription());
        project.setTenant(tenants.findById(tenantId)
                .orElseThrow(() -> new IllegalStateException("Tenant was not found")));
        project.setCohort(cohortOf(team));
        project.setStatus(ProjectStatus.PLANNING);
        project.setTemplateSnapshotId(snapshot.getId());
        project.setClassId(team.getTrainingClass().getId());
        project.setTeamId(team.getId());
        project.setIsActive(true);
        project.setCreatedBy(actorId);
        project.setUpdatedBy(actorId);

        return projects.saveAndFlush(project);
    }

    private String resolveProjectName(ProjectTeam team, ProjectTemplate template) {

        if (template.getName() != null && !template.getName().isBlank()) {
            return template.getName();
        }
        return "Project / " + team.getTeamName();
    }

    private Cohort cohortOf(ProjectTeam team) {

        Long cohortId = team.getTrainingClass().getCohortId();
        return cohortId == null ? null : cohorts.findById(cohortId).orElse(null);
    }

    /** {@code <class code>-T<team id>[-n]} truncated to the 100 char project code column. */
    private String uniqueProjectCode(ProjectTeam team, Long tenantId) {

        String classCode = team.getTrainingClass().getCode();
        String base = (classCode == null || classCode.isBlank() ? "PRJ" : classCode) + "-T" + team.getId();
        String candidate = truncate(base, PROJECT_CODE_MAX);

        int suffix = 1;
        while (projects.findByCodeAndTenantId(candidate, tenantId).isPresent()) {
            suffix++;
            String appendix = "-" + suffix;
            candidate = truncate(base, PROJECT_CODE_MAX - appendix.length()) + appendix;
        }
        return candidate;
    }

    // ------------------------------------------------------------------
    // Step 3 — Workspace
    // ------------------------------------------------------------------

    private Workspace ensureWorkspace(ProjectTeam team,
                                      Project project,
                                      Long tenantId,
                                      Long actorId,
                                      String correlationId) {

        Workspace existing = workspaces.findFirstByTeamIdOrderByIdAsc(team.getId()).orElse(null);
        if (existing != null) {
            if (existing.getProject() == null) {
                existing.setProject(project);
                workspaces.saveAndFlush(existing);
            }
            return existing;
        }

        Tenant tenant = tenants.findById(tenantId)
                .orElseThrow(() -> new IllegalStateException("Tenant " + tenantId + " not found"));

        Workspace workspace = new Workspace();
        workspace.setTenant(tenant);
        workspace.setTeam(team);
        workspace.setProject(project);
        workspace.setCode("WS-TEAM-" + team.getId());
        workspace.setName("Workspace / " + team.getTeamName());
        workspace.setStatus(WorkspaceStatus.ACTIVE);
        workspace.setCreatedBy(actorId);
        workspace.setIsActive(true);
        workspace.setSections(new ArrayList<>(Arrays.asList(WorkspaceSection.values())));
        Workspace saved = workspaces.saveAndFlush(workspace);

        workspaceJournal.recordCreation(saved, actor(actorId), response(saved, tenantId, project, team), correlationId);

        return saved;
    }

    private WorkspaceResponse response(Workspace workspace, Long tenantId, Project project, ProjectTeam team) {

        return WorkspaceResponse.builder()
                .id(workspace.getId())
                .tenantId(tenantId)
                .projectId(project.getId())
                .teamId(team.getId())
                .code(workspace.getCode())
                .name(workspace.getName())
                .status(workspace.getStatus())
                .createdBy(workspace.getCreatedBy())
                .createdAt(workspace.getCreatedAt())
                .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList())
                .build();
    }

    // ------------------------------------------------------------------
    // Step 3a — Milestones (deadline, rubric, checklist, late policy)
    // ------------------------------------------------------------------

    private int generateMilestones(ProjectTeam team,
                                   Project project,
                                   Long tenantId,
                                   Long actorId,
                                   Instant now,
                                   List<TemplateMilestone> plan) {

        if (plan.isEmpty()) {
            return 0;
        }

        UUID actorUuid = actorUuid(actorId);
        int created = 0;

        for (TemplateMilestone planMilestone : plan) {
            Instant deadline = deadlineOf(planMilestone, now);
            boolean allowLate = Boolean.TRUE.equals(planMilestone.getAllowLateSubmission());
            Instant lateUntil = allowLate
                    ? deadline.plus(planMilestone.getMaxLateDays(), ChronoUnit.DAYS)
                    : null;
            BigDecimal penalty = allowLate ? planMilestone.getPenaltyPerDayPercent() : null;

            Milestone milestone = Milestone.create(
                    tenantId,
                    project.getId(),
                    team.getId(),
                    planMilestone.getTitle(),
                    planMilestone.getDescription(),
                    deadline,
                    planMilestone.isMandatory(),
                    planMilestone.getRubricVersion().getId(),
                    null,
                    allowLate ? LatePolicyType.ALLOW_LATE : LatePolicyType.NO_LATE,
                    lateUntil,
                    penalty,
                    actorUuid,
                    now);

            milestone.configureAssessment(
                    planMilestone.getWeight(),
                    allowLate ? LatePenaltyBasis.PER_DAY : LatePenaltyBasis.FIXED);

            for (TemplateMilestoneChecklistItem item : planMilestone.getChecklistItems()) {
                milestone.addChecklistItem(item.getContent(), item.isMandatory(), item.getOrderIndex());
            }

            milestones.saveAndFlush(milestone);
            created++;
        }

        return created;
    }

    private Instant deadlineOf(TemplateMilestone milestone, Instant startsAt) {
        long days = milestone.getDueAfter().longValue()
                * (milestone.getDueUnit() == TemplateMilestoneTimeUnit.WEEKS ? 7L : 1L);
        return startsAt.plus(days, ChronoUnit.DAYS);
    }

    private int generateSampleBacklog(Project project, ProjectTemplate template) {
        List<TemplateBacklogItem> items =
                templateBacklogItems.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        int created = 0;
        for (TemplateBacklogItem item : items) {
            String title = truncate(item.getTitle(), 200);
            if (sprintBacklog.findByProjectIdAndSprintIsNullAndTitleIgnoreCase(project.getId(), title).isPresent()) {
                continue;
            }
            sprintBacklog.saveAndFlush(SprintBacklog.builder()
                    .projectId(project.getId())
                    .title(title)
                    .description(item.getDescription())
                    .status(SprintBacklogStatus.TODO)
                    .workType(SprintBacklogWorkType.STORY)
                    .priority(SprintBacklogPriority.MEDIUM)
                    .isActive(true)
                    .version(0L)
                    .build());
            created++;
        }
        return created;
    }

    private void recordActivity(Workspace workspace,
                                Long tenantId,
                                Long actorId,
                                String correlationId,
                                String action) {

        WorkspaceActivity activity = new WorkspaceActivity();
        activity.setEventId(UUID.randomUUID().toString());
        activity.setTenantId(tenantId);
        activity.setActorId(actorId);
        activity.setWorkspaceId(workspace.getId());
        activity.setAction(truncate(action, 40));
        activity.setCorrelationId(truncate(correlationId == null ? UUID.randomUUID().toString() : correlationId, 64));
        activity.setOccurredAt(Instant.now());
        activity.setIsActive(true);
        activities.saveAndFlush(activity);
    }

    // ------------------------------------------------------------------
    // Audit / outbox
    // ------------------------------------------------------------------

    private void recordProvisioning(ProjectTeam team,
                                    Project project,
                                    ProjectTemplate template,
                                    ProjectTemplateSnapshot snapshot,
                                    Workspace workspace,
                                    int milestoneCount,
                                    int backlogItemCount,
                                    Long actorId,
                                    String correlationId) {

        Map<String, Object> state = new LinkedHashMap<>();
        state.put("teamId", team.getId());
        state.put("classId", team.getTrainingClass().getId());
        state.put("classCode", team.getTrainingClass().getCode());
        state.put("projectId", project.getId());
        state.put("projectCode", project.getCode());
        state.put("projectStatus", project.getStatus() == null ? null : project.getStatus().name());
        state.put("projectTemplateId", template.getId());
        state.put("templateSnapshotId", snapshot.getId());
        state.put("templateSnapshotVersion", snapshot.getVersion());
        state.put("workspaceId", workspace.getId());
        state.put("milestones", milestoneCount);
        state.put("backlogItems", backlogItemCount);
        state.put("members", roster(team));

        String payload;
        try {
            payload = objectMapper.writeValueAsString(state);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize the provisioning state", exception);
        }

        audits.save(ProjectTeamAudit.builder()
                .action(AUDIT_ACTION)
                .actorId(actorId)
                .classId(team.getTrainingClass().getId())
                .allocationSessionId(team.getAllocationSession() == null
                        ? null
                        : team.getAllocationSession().getId())
                .beforeState("null")
                .afterState(payload)
                .correlationId(truncate(correlationId == null ? UUID.randomUUID().toString() : correlationId, 100))
                .build());

        outbox.save(ProjectTeamOutboxEvent.builder()
                .eventType(OUTBOX_EVENT)
                .aggregateId(team.getId())
                .payload(payload)
                .correlationId(truncate(correlationId == null ? UUID.randomUUID().toString() : correlationId, 100))
                .status("PENDING")
                .build());
    }

    /** Team Charter roster (members + roles) copied into the project evidence payload. */
    private List<Map<String, Object>> roster(ProjectTeam team) {

        List<Map<String, Object>> rows = new ArrayList<>();
        for (ProjectMember member : projectMembers.findAllByTeam_IdOrderByIdAsc(team.getId())) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("memberId", member.getClassMember() == null ? null : member.getClassMember().getId());
            row.put("userId", member.getClassMember() == null || member.getClassMember().getUser() == null
                    ? null
                    : member.getClassMember().getUser().getId());
            row.put("fullName", member.getClassMember() == null || member.getClassMember().getUser() == null
                    ? null
                    : member.getClassMember().getUser().getFullName());
            row.put("roles", ProjectMemberRole.parseRoles(member.getRole()));
            rows.add(row);
        }
        return rows;
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private User actor(Long actorId) {

        return users.findByIdAndIsActiveTrue(actorId)
                .orElseThrow(() -> new IllegalStateException("Actor " + actorId + " not found"));
    }

    private UUID actorUuid(Long actorId) {

        return UUID.nameUUIDFromBytes(("user:" + actorId).getBytes(StandardCharsets.UTF_8));
    }

    private static String truncate(String value, int max) {

        if (value == null) {
            return null;
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}
