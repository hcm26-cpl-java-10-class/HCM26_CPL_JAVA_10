package com.example.starter_project_2025.init;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.service.RubricCatalogService;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAudit;
import com.example.starter_project_2025.system.project.template.ProjectTemplateAuditRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateLevel;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import com.example.starter_project_2025.system.project.template.TemplateConfigurationService;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestone;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneChecklistItem;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneRepository;
import com.example.starter_project_2025.system.project.template.milestone.TemplateMilestoneTimeUnit;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Order(15)
@Component
@RequiredArgsConstructor
@Profile("!prod")
@ConditionalOnProperty(prefix = "app.seed.team-allocation", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ProjectTeamTemplateDemoDataInitializer implements CommandLineRunner {
    private static final String SEED_ACTION = "PROJECT_TEMPLATE_DEMO_SEEDED_V2";
    private static final List<String> RUBRIC_NAMES = List.of(
            "Technical Documentation Rubric", "Milestone Delivery Rubric", "Demo and Presentation Rubric");
    private static final List<TemplateSeed> TEMPLATES = List.of(
            new TemplateSeed("SAMPLE-WEB-PORTAL", "Campus Service Portal", "Web Application",
                    ProjectTemplateLevel.INTERMEDIATE, 10, 4, 6, false, new RoleQuotas(1, 1, 1, 1),
                    "room booking, support requests and service notifications",
                    "students, campus staff and service administrators",
                    List.of("Room availability and booking", "Support request tracking", "Service notifications and reports")),
            new TemplateSeed("SAMPLE-MOBILE-BOOKING", "Mobile Appointment Booking", "Mobile Application",
                    ProjectTemplateLevel.INTERMEDIATE, 9, 3, 4, true, new RoleQuotas(1, 1, 1, 0),
                    "appointment scheduling, reminders and booking management",
                    "customers, service providers and reception staff",
                    List.of("Service and provider discovery", "Appointment booking and cancellation", "Mobile reminders and booking history")),
            new TemplateSeed("SAMPLE-DATA-REPORTING", "Sales Analytics Dashboard", "Data Analytics",
                    ProjectTemplateLevel.BEGINNER, 8, 2, 5, true, new RoleQuotas(1, 0, 1, 0),
                    "sales data preparation, KPI reporting and interactive dashboards",
                    "sales analysts, branch managers and business owners",
                    List.of("Sales data import and validation", "Revenue and conversion analysis", "Interactive KPI dashboard")),
            new TemplateSeed("SAMPLE-CAPSTONE-ERP", "Inventory and Order Management", "Capstone",
                    ProjectTemplateLevel.ADVANCED, 15, 5, 7, false, new RoleQuotas(1, 1, 2, 1),
                    "inventory control, purchase orders and stock reconciliation",
                    "warehouse operators, purchasing staff and operations managers",
                    List.of("Product and supplier management", "Purchase orders and stock movements", "Stock reconciliation and audit reports")),
            new TemplateSeed("SAMPLE-TEAM-COLLAB", "Team Collaboration Workspace", "Cross-functional",
                    ProjectTemplateLevel.INTERMEDIATE, 12, 4, 8, true, new RoleQuotas(1, 1, 1, 1),
                    "team planning, shared work items and progress reporting",
                    "team leaders, project members and mentors",
                    List.of("Team membership and role management", "Shared work planning and progress tracking", "Project discussion and weekly reports")),
            new TemplateSeed("SAMPLE-WEB-SHOP", "Student Marketplace", "Web Application",
                    ProjectTemplateLevel.BEGINNER, 8, 3, 5, false, new RoleQuotas(1, 0, 1, 1),
                    "product listings, purchase requests and marketplace moderation",
                    "student buyers, student sellers and marketplace moderators",
                    List.of("Product listings and search", "Purchase requests and order tracking", "Seller feedback and moderation")),
            new TemplateSeed("SAMPLE-MOBILE-LEARNING", "Mobile Learning Companion", "Mobile Application",
                    ProjectTemplateLevel.INTERMEDIATE, 10, 4, 6, false, new RoleQuotas(1, 1, 1, 1),
                    "learning schedules, practice quizzes and personal progress tracking",
                    "learners, instructors and academic support staff",
                    List.of("Course content and study schedules", "Practice quizzes and instant feedback", "Learning progress and reminders")),
            new TemplateSeed("SAMPLE-DATA-INSIGHTS", "Student Performance Analytics", "Data Analytics",
                    ProjectTemplateLevel.ADVANCED, 12, 4, 6, false, new RoleQuotas(1, 1, 1, 1),
                    "academic data quality, performance indicators and early risk analysis",
                    "program managers, mentors and academic advisors",
                    List.of("Academic dataset preparation", "Performance trends and risk indicators", "Advisor dashboards and summary reports"))
    );

    private final ProjectTemplateRepository templates;
    private final TenantRepository tenants;
    private final UserRepository users;
    private final TemplateMilestoneRepository milestones;
    private final TemplateBacklogItemRepository backlog;
    private final RubricCatalogService rubricCatalog;
    private final ProjectTemplateAuditRepository audits;
    private final TemplateConfigurationService configurations;
    private final ObjectMapper json;

    @Value("${app.seed.admin.email:admin@example.com}")
    private String adminEmail;

    @Override
    @Transactional
    public void run(String... args) {
        ensureManualDefaultTemplate();
        var actor = users.findByEmail(adminEmail).orElseThrow();
        Long tenantId = actor.getTenantId() != null ? actor.getTenantId()
                : tenants.findByCode("LOCAL_TRAINING").orElseThrow().getId();
        Map<String, RubricVersion> rubricVersions = new LinkedHashMap<>();
        rubricCatalog.findPublished(tenantId).forEach(version -> rubricVersions.putIfAbsent(version.getNameSnapshot(), version));
        if (!rubricVersions.keySet().containsAll(RUBRIC_NAMES)) {
            log.info("Project template demo data skipped: the published demo rubrics are unavailable.");
            return;
        }
        int created = 0;
        for (TemplateSeed seed : TEMPLATES) {
            String correlationId = UUID.nameUUIDFromBytes(("project-template-demo:" + tenantId + ":" + seed.code())
                    .getBytes(StandardCharsets.UTF_8)).toString();
            if (audits.existsByTenantIdAndActionAndCorrelationId(tenantId, SEED_ACTION, correlationId)) continue;
            ProjectTemplate template = templates.findAll().stream()
                    .filter(row -> tenantId.equals(row.getTenantId()) && seed.code().equals(row.getCode()))
                    .findFirst().orElse(null);
            boolean newTemplate = template == null;
            if (newTemplate) {
                template = templates.saveAndFlush(ProjectTemplate.builder().tenantId(tenantId).code(seed.code())
                        .name(seed.name()).description(description(seed)).category(seed.category()).level(seed.level())
                        .estimatedDurationWeeks(seed.weeks()).constraintsJson(constraints(seed))
                        .status(ProjectTemplateStatus.DRAFT).templateVersion(1).build());
                seedMilestones(template, seed, RUBRIC_NAMES.stream().map(rubricVersions::get).toList());
                seedBacklog(template, seed);
                created++;
            }
            String state = configurations.capture(template);
            audits.save(new ProjectTemplateAudit(tenantId, template.getId(), actor.getId(), SEED_ACTION,
                    newTemplate ? null : state, state, correlationId));
        }
        log.info("Project template demo data ensured ({} new, {} configured samples).", created, TEMPLATES.size());
    }

    private String description(TemplateSeed seed) {
        String features = String.join(", ", seed.features().stream().map(value -> value.toLowerCase(Locale.ROOT)).toList());
        return """
                Build %s for %s. The project covers %s.

                The team will deliver %s. Include authentication, role-based access, input validation, clear loading and error states, and meaningful tests for the main business flows.

                Expected outcomes include a working application or data dashboard, a reviewed data model, documented setup steps, a demonstration script, and a final project retrospective. Use the configured milestone schedule and rubrics to review progress. The sample backlog provides initial work that the team can refine before planning a sprint.
                """.formatted(seed.name().toLowerCase(Locale.ROOT), seed.users(), seed.scope(), features).strip();
    }

    private String constraints(TemplateSeed seed) {
        try {
            return json.writeValueAsString(Map.of("min_members", seed.minMembers(), "max_members", seed.maxMembers(),
                    "allow_multi_role", seed.allowMultiRole(), "role_quotas", Map.of("PM", seed.roles().pm(),
                            "BA", seed.roles().ba(), "DEV", seed.roles().dev(), "QA", seed.roles().qa())));
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to prepare demo team constraints", exception);
        }
    }

    private void seedMilestones(ProjectTemplate template, TemplateSeed seed, List<RubricVersion> rubrics) {
        List<String> titles = List.of("Requirements and solution design", "Core implementation and verification", "Final demonstration and handover");
        List<String> descriptions = List.of(
                "Agree the scope for " + seed.scope() + ", document user journeys and review the architecture and data model.",
                "Implement " + seed.features().get(0).toLowerCase(Locale.ROOT) + " and "
                        + seed.features().get(1).toLowerCase(Locale.ROOT) + " with input validation, access control and automated checks.",
                "Complete " + seed.features().get(2).toLowerCase(Locale.ROOT)
                        + ", demonstrate the full workflow and hand over deployment instructions, test evidence and a retrospective.");
        List<List<String>> checklists = List.of(
                List.of("Scope and acceptance criteria approved", "Architecture and data model reviewed", "Team roles and delivery plan agreed"),
                List.of("Core workflow works end-to-end", "Input validation and permissions verified", "Main business flows covered by tests"),
                List.of("All required features demonstrated", "Setup and user documentation completed", "Final test evidence and retrospective reviewed"));
        List<Integer> dueWeeks = List.of(Math.max(1, seed.weeks() / 5), (int) (seed.weeks() * 0.55), seed.weeks());
        List<TemplateMilestone> plan = new ArrayList<>();
        for (int index = 0; index < titles.size(); index++) {
            var milestone = new TemplateMilestone();
            milestone.setTemplate(template);
            milestone.setTitle(titles.get(index));
            milestone.setDescription(descriptions.get(index));
            milestone.setDueAfter(dueWeeks.get(index));
            milestone.setDueUnit(TemplateMilestoneTimeUnit.WEEKS);
            milestone.setWeight(BigDecimal.valueOf(index == 0 ? 20 : 40));
            milestone.setMandatory(true);
            milestone.setOrderIndex(index);
            milestone.setRubricVersion(rubrics.get(index));
            milestone.setAllowLateSubmission(index != 2);
            milestone.setMaxLateDays(index == 2 ? 0 : 2);
            milestone.setPenaltyPerDayPercent(BigDecimal.valueOf(index == 2 ? 0 : 5));
            for (int order = 0; order < checklists.get(index).size(); order++) {
                var item = new TemplateMilestoneChecklistItem();
                item.setMilestone(milestone);
                item.setContent(checklists.get(index).get(order));
                item.setMandatory(true);
                item.setOrderIndex(order);
                milestone.getChecklistItems().add(item);
            }
            plan.add(milestone);
        }
        milestones.saveAllAndFlush(plan);
    }

    private void seedBacklog(ProjectTemplate template, TemplateSeed seed) {
        backlog.saveAllAndFlush(List.of(
                backlogItem(template, 0, "Plan project delivery",
                        "Confirm team roles, communication rules and the milestone plan for " + seed.name() + ".", ProjectMemberRole.PM),
                backlogItem(template, 1, "Analyse requirements and acceptance criteria",
                        "Describe the user journeys and acceptance criteria for " + seed.scope() + ".", ProjectMemberRole.BA),
                backlogItem(template, 2, "Design architecture and data model",
                        "Prepare the architecture diagram, database schema and API or data contracts.", ProjectMemberRole.DEV),
                backlogItem(template, 3, seed.features().get(0),
                        "Implement " + seed.features().get(0).toLowerCase(Locale.ROOT)
                                + " with validation, permissions and useful feedback.", ProjectMemberRole.DEV),
                backlogItem(template, 4, seed.features().get(1),
                        "Implement " + seed.features().get(1).toLowerCase(Locale.ROOT)
                                + " and connect the complete business workflow.", ProjectMemberRole.DEV),
                backlogItem(template, 5, seed.features().get(2),
                        "Deliver " + seed.features().get(2).toLowerCase(Locale.ROOT)
                                + " with accessible views and consistent loading and error handling.", ProjectMemberRole.DEV),
                backlogItem(template, 6, "Verify main workflows and permissions",
                        "Prepare test cases, exercise validation and access rules, and record regression results.", ProjectMemberRole.QA),
                backlogItem(template, 7, "Prepare demonstration and handover",
                        "Document setup steps, prepare demo data and summarize outcomes and lessons learned.", ProjectMemberRole.PM)));
    }

    private TemplateBacklogItem backlogItem(ProjectTemplate template, int order, String title, String description, ProjectMemberRole role) {
        var item = new TemplateBacklogItem();
        item.setTemplate(template);
        item.setTitle(title);
        item.setDescription(description);
        item.setSuggestedRole(role);
        item.setOrderIndex(order);
        return item;
    }

    private void ensureManualDefaultTemplate() {
        templates.findByCodeAndTenantIdIsNullAndIsActiveTrue("MANUAL-GROUPING-DEFAULT").ifPresent(template -> {
            if ("{\"max_members\":5}".equals(template.getConstraintsJson())) {
                template.setConstraintsJson("{\"min_members\":1,\"max_members\":5}");
                templates.save(template);
            }
        });
    }

    private record RoleQuotas(int pm, int ba, int dev, int qa) { }

    private record TemplateSeed(String code, String name, String category, ProjectTemplateLevel level, int weeks,
                                int minMembers, int maxMembers, boolean allowMultiRole, RoleQuotas roles,
                                String scope, String users, List<String> features) { }
}
