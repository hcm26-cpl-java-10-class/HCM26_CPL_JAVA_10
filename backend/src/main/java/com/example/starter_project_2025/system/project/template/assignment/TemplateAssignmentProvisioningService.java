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
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersionStatus;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import com.example.starter_project_2025.system.project.sprint.Sprint;
import com.example.starter_project_2025.system.project.sprint.SprintRepository;
import com.example.starter_project_2025.system.project.sprint.SprintStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklog;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogPriority;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogRepository;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogStatus;
import com.example.starter_project_2025.system.project.sprint_backlog.SprintBacklogWorkType;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirement;
import com.example.starter_project_2025.system.project.template.artifact.TemplateArtifactRequirementRepository;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneChecklistItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
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
import java.time.LocalDateTime;
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
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-13 — materialises a team brief into the project/workspace model.
 * <p>
 * Runs inside the same transaction as
 * {@code ProjectTeamTemplateService.applyAssignment} (that is the "background
 * transaction" of the flow) and executes the three steps of the agreed flow:
 * <ol>
 *     <li><b>Snapshot</b> — {@link TemplateBriefSnapshotWriter} copies the active
 *     {@link ProjectTemplate} version into a new immutable
 *     {@link ProjectTemplateSnapshot} and returns its unique id.</li>
 *     <li><b>Project</b> — a {@link Project} row is silently inserted with
 *     {@code team_id}, {@code class_id}, {@code template_snapshot_id} and the
 *     {@link ProjectStatus#PLANNING} status; the team points at it and the
 *     existing team members/roles become the project roster.</li>
 *     <li><b>Workspace</b> — an ACTIVE {@link Workspace} is created for the team
 *     and the brief is fanned out into milestones (with rubric, checklist and
 *     late policy), a first sprint plus backlog items, artifact requirements and
 *     activity-feed rows.</li>
 * </ol>
 * Everything is idempotent per team: a team that already owns a project keeps
 * it and only the team-level brief pointer changes.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TemplateAssignmentProvisioningService {

    public static final String AUDIT_ACTION = "PROVISION_TEAM_PROJECT";
    public static final String OUTBOX_EVENT = "TEAM_PROJECT_PROVISIONED";
    public static final String ACTIVITY_WORKSPACE_GENERATED = "WORKSPACE_COMPONENTS_GENERATED";
    public static final String ACTIVITY_ARTIFACT_REQUIRED = "ARTIFACT_REQUIREMENT_IMPORTED";

    private static final int DEFAULT_MAX_LATE_DAYS = 3;
    private static final BigDecimal DEFAULT_LATE_PENALTY = new BigDecimal("10.00");
    private static final int DEFAULT_SPRINT_WEEKS = 2;
    private static final int PROJECT_CODE_MAX = 100;
    private static final int SPRINT_NAME_MAX = 255;

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
    private final SprintRepository sprints;
    private final SprintBacklogRepository sprintBacklog;
    private final TemplateMilestoneRepository templateMilestones;
    private final TemplateBacklogItemRepository templateBacklogItems;
    private final TemplateArtifactRequirementRepository templateArtifacts;
    private final RubricVersionRepository rubricVersions;
    private final TemplateBriefSnapshotWriter briefSnapshots;
    private final ObjectMapper objectMapper;

    /**
     * Provisions project + workspace for a team that just received a brief.
     * Reassigning a brief on a team that already owns a project is a no-op here
     * (the assignment service still updates {@code project_teams.project_template_id}).
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void provision(ProjectTeam team, ProjectTemplate template, Long actorId, String correlationId) {

        if (team.getProjectId() != null) {
            log.debug("US-13 team {} already owns project {} - provisioning skipped",
                    team.getId(), team.getProjectId());
            return;
        }

        Long tenantId = Objects.requireNonNull(team.getTrainingClass().getTenantId(),
                "The training class must belong to a tenant");
        Instant now = Instant.now();

        // ---- Step 1: immutable evidence snapshot of the active brief version
        ProjectTemplateSnapshot snapshot = briefSnapshots.snapshotForAssignment(template, team.getId());

        // ---- Step 2: silent project creation (PLANNING until the team is published)
        Project project = createProject(team, template, snapshot, tenantId, actorId);
        briefSnapshots.linkProject(snapshot, project.getId());

        team.setProject(project);
        teams.saveAndFlush(team);

        // ---- Step 3: workspace + generated components
        Workspace workspace = ensureWorkspace(team, project, tenantId, actorId, correlationId);

        List<TemplateMilestone> milestonePlan =
                templateMilestones.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        int generatedMilestones = generateMilestones(
                team, project, tenantId, actorId, now, milestonePlan);
        int generatedBacklogItems = generateSprintAndBacklog(team, project, template, now);
        int artifactRequirements = recordArtifactActivity(workspace, tenantId, actorId, correlationId, template);

        recordActivity(workspace, tenantId, actorId, correlationId, ACTIVITY_WORKSPACE_GENERATED);

        recordProvisioning(team, project, template, snapshot, workspace,
                generatedMilestones, generatedBacklogItems, artifactRequirements, actorId, correlationId);
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
        project.setTenantId(tenantId);
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

        UUID rubricSnapshotId = resolveRubricVersion(tenantId, plan);
        if (rubricSnapshotId == null) {
            log.warn("US-13 team {}: no published rubric for tenant {} - milestone generation skipped",
                    team.getId(), tenantId);
            return 0;
        }

        UUID actorUuid = actorUuid(actorId);
        int created = 0;

        for (TemplateMilestone planMilestone : plan) {
            if (milestones.existsByTenantIdAndProjectIdAndTitle(
                    tenantId, project.getId(), planMilestone.getTitle())) {
                continue;
            }

            Instant deadline = deadlineOf(planMilestone, now);
            boolean allowLate = Boolean.TRUE.equals(planMilestone.getAllowLateSubmission());
            Instant lateUntil = allowLate
                    ? deadline.plus(maxLateDays(planMilestone), ChronoUnit.DAYS)
                    : null;
            BigDecimal penalty = allowLate ? latePenalty(planMilestone) : null;

            Milestone milestone = Milestone.create(
                    tenantId,
                    project.getId(),
                    team.getId(),
                    planMilestone.getTitle(),
                    planMilestone.getDescription(),
                    deadline,
                    planMilestone.isMandatory(),
                    rubricSnapshotId,
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

    private Instant deadlineOf(TemplateMilestone milestone, Instant now) {

        int amount = milestone.getDueAfter() == null ? 7 : milestone.getDueAfter();
        long days = milestone.getDueUnit() == TemplateMilestoneTimeUnit.WEEKS
                ? amount * 7L
                : amount;
        return now.plus(Math.max(days, 1L), ChronoUnit.DAYS);
    }

    private int maxLateDays(TemplateMilestone milestone) {

        Integer value = milestone.getMaxLateDays();
        return value == null || value <= 0 ? DEFAULT_MAX_LATE_DAYS : value;
    }

    private BigDecimal latePenalty(TemplateMilestone milestone) {

        BigDecimal value = milestone.getPenaltyPerDayPercent();
        return value == null ? DEFAULT_LATE_PENALTY : value;
    }

    private UUID resolveRubricVersion(Long tenantId, List<TemplateMilestone> plan) {

        for (TemplateMilestone milestone : plan) {
            if (milestone.getRubricVersion() != null) {
                return milestone.getRubricVersion().getId();
            }
        }
        return rubricVersions
                .findAllByRubricTenantIdAndStatusOrderByNameSnapshotAscVersionNumberDesc(
                        RubricTenantIdentity.from(tenantId), RubricVersionStatus.PUBLISHED)
                .stream()
                .map(RubricVersion::getId)
                .findFirst()
                .orElse(null);
    }

    // ------------------------------------------------------------------
    // Step 3b — Sprint & backlog
    // ------------------------------------------------------------------

    private int generateSprintAndBacklog(ProjectTeam team,
                                         Project project,
                                         ProjectTemplate template,
                                         Instant now) {

        List<TemplateBacklogItem> items =
                templateBacklogItems.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());
        if (items.isEmpty()) {
            return 0;
        }

        LocalDateTime start = LocalDateTime.now();
        Sprint sprint = sprints.findByName(sprintName(project))
                .orElseGet(() -> sprints.saveAndFlush(Sprint.builder()
                        .projectId(project.getId())
                        .teamId(team.getId())
                        .name(sprintName(project))
                        .sprintGoal("Khung làm việc ban đầu cho đề bài "
                                + (template.getName() == null ? project.getName() : template.getName()))
                        .startDate(start)
                        .endDate(start.plusWeeks(DEFAULT_SPRINT_WEEKS))
                        .status(SprintStatus.PLANNED)
                        .isActive(true)
                        .version(0L)
                        .build()));

        int created = 0;
        for (TemplateBacklogItem item : items) {
            if (sprintBacklog.findBySprintIdAndTitleIgnoreCase(sprint.getId(), item.getTitle()).isPresent()) {
                continue;
            }
            sprintBacklog.saveAndFlush(SprintBacklog.builder()
                    .sprint(sprint)
                    .projectId(project.getId())
                    .title(truncate(item.getTitle(), 200))
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

    private String sprintName(Project project) {

        return truncate(project.getCode() + " - Sprint 1", SPRINT_NAME_MAX);
    }

    // ------------------------------------------------------------------
    // Step 3c — Artifacts & activity feed
    // ------------------------------------------------------------------

    private int recordArtifactActivity(Workspace workspace,
                                       Long tenantId,
                                       Long actorId,
                                       String correlationId,
                                       ProjectTemplate template) {

        List<TemplateArtifactRequirement> requirements =
                templateArtifacts.findAllByTemplate_IdOrderByOrderIndexAscIdAsc(template.getId());

        for (TemplateArtifactRequirement requirement : requirements) {
            recordActivity(workspace, tenantId, actorId, correlationId, ACTIVITY_ARTIFACT_REQUIRED);
        }
        return requirements.size();
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
                                    int artifactRequirementCount,
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
        state.put("artifactRequirements", artifactRequirementCount);
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
