package com.example.starter_project_2025.system.project.template.assignment.hierarchy.demo;

import com.example.starter_project_2025.system.project.ProjectTemplate;
import com.example.starter_project_2025.system.project.ProjectTemplateRepository;
import com.example.starter_project_2025.system.project.project_template_version.ProjectTemplateSnapshotService;
import com.example.starter_project_2025.system.project.rubric.domain.Rubric;
import com.example.starter_project_2025.system.project.rubric.domain.RubricVersion;
import com.example.starter_project_2025.system.project.rubric.integration.RubricTenantIdentity;
import com.example.starter_project_2025.system.project.rubric.repository.RubricRepository;
import com.example.starter_project_2025.system.project.rubric.repository.RubricVersionRepository;
import com.example.starter_project_2025.system.project.template.*;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItem;
import com.example.starter_project_2025.system.project.template.backlog.TemplateBacklogItemRepository;
import com.example.starter_project_2025.system.project.template.milestone.*;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class HierarchyDemoTemplates {
    public record Library(ProjectTemplate master, List<ProjectTemplate> modules) { }
    private final ProjectTemplateRepository templates;
    private final TemplateMilestoneRepository milestones;
    private final TemplateBacklogItemRepository backlog;
    private final RubricRepository rubrics;
    private final RubricVersionRepository rubricVersions;
    private final ProjectTemplateSnapshotService versions;
    private final TemplateActivationService activation;
    private final HierarchyDemoFiles files;

    public Library create(User admin) {
        RubricVersion rubric = rubric(admin);
        Library published = tree(admin, rubric, "HIER-DEMO-ECOM", "Demo E-Commerce Hub", true);
        tree(admin, rubric, "HIER-DEMO-EDIT", "Demo Module Configuration", false);
        return published;
    }

    private Library tree(User admin, RubricVersion rubric, String code, String name, boolean publish) {
        if (templates.existsByTenantIdAndCodeScopeIdAndCodeAndTemplateVersion(admin.getTenantId(), 0L, code, 1))
            throw new IllegalStateException("Reserved hierarchy demo template already exists: " + code);
        ProjectTemplate master = template(admin, code, name, null, rubric);
        versions.createInitialVersion(master);
        files.attach(master, "architecture-spec.pdf");
        files.attach(master, "git-guideline.pdf");
        ProjectTemplate auth = template(admin, "MOD-AUTH", "Module Auth", master, rubric);
        versions.createInitialVersion(auth);
        files.attach(auth, "auth-spec.pdf"); files.attach(auth, "auth-sample.csv");
        ProjectTemplate payment = template(admin, "MOD-PAYMENT", "Module Payment", master, rubric);
        versions.createInitialVersion(payment);
        files.attach(payment, "payment-api.pdf"); files.attach(payment, "payment-sdk.zip");
        ProjectTemplate catalog = template(admin, "MOD-CATALOG", "Module Catalog", master, rubric);
        versions.createInitialVersion(catalog);
        files.attach(catalog, "catalog-spec.pdf");
        List<ProjectTemplate> modules = List.of(auth, payment, catalog);
        for (ProjectTemplate module : modules) {
            if (publish) activate(module);
        }
        if (publish) activate(master);
        return new Library(master, modules);
    }

    private ProjectTemplate template(User admin, String code, String name, ProjectTemplate parent, RubricVersion rubric) {
        int max = parent == null ? 8 : 5;
        ProjectTemplate template = templates.saveAndFlush(ProjectTemplate.builder().tenantId(admin.getTenantId())
                .code(code).name(name).parentTemplate(parent).technologyStack("Java Spring Boot, React, H2")
                .description(parent == null ? "Original v1.0 brief: coordinate the Auth, Payment and Catalog modules for an E-Commerce platform."
                        : "Original v1.0 brief for " + name + ": design the API and database, implement the module and verify its integration contract.")
                .category("Web Application").level("INTERMEDIATE").estimatedDurationWeeks(4)
                .constraintsJson("{\"min_members\":4,\"max_members\":" + max
                        + ",\"allow_multi_role\":false,\"role_quotas\":{\"PM\":1,\"BA\":1,\"DEV\":1,\"QA\":1}}")
                .status(ProjectTemplateStatus.DRAFT).templateVersion(1).createdBy(admin.getId()).build());
        if (parent == null) milestone(template, rubric, 0, "System architecture review", 3, new BigDecimal("100"));
        else {
            milestone(template, rubric, 0, "Design API & Database", 7, BigDecimal.ZERO);
            milestone(template, rubric, 1, "Integration & Testing", 14, BigDecimal.ZERO);
        }
        for (int index = 0; index < 2; index++) {
            TemplateBacklogItem item = new TemplateBacklogItem();
            item.setTemplate(template); item.setOrderIndex(index);
            item.setTitle((index == 0 ? "Design " : "Implement and test ") + name);
            item.setDescription("Deliver " + name + " using its frozen brief, rubric and shared API contracts.");
            backlog.save(item);
        }
        backlog.flush();
        return template;
    }

    private void milestone(ProjectTemplate template, RubricVersion rubric, int order, String title, int days, BigDecimal weight) {
        TemplateMilestone milestone = new TemplateMilestone();
        milestone.setTemplate(template); milestone.setTitle(title); milestone.setDescription(title + " for " + template.getName());
        milestone.setOrderIndex(order); milestone.setDueAfter(days); milestone.setDueUnit(TemplateMilestoneTimeUnit.DAYS);
        milestone.setWeight(weight); milestone.setMandatory(true); milestone.setRubricVersion(rubric);
        milestone.setAllowLateSubmission(true); milestone.setMaxLateDays(3); milestone.setPenaltyPerDayPercent(new BigDecimal("5"));
        List<String> checklist = List.of("API contract and database reviewed", "Implementation and verification evidence provided");
        for (int index = 0; index < checklist.size(); index++) {
            TemplateMilestoneChecklistItem item = new TemplateMilestoneChecklistItem();
            item.setMilestone(milestone); item.setOrderIndex(index); item.setMandatory(true); item.setContent(checklist.get(index));
            milestone.getChecklistItems().add(item);
        }
        milestones.saveAndFlush(milestone);
    }

    private void activate(ProjectTemplate template) {
        activation.activate(template.getId(), new TemplateActivationRequest(BigDecimal.valueOf(template.getLockVersion())));
    }

    private RubricVersion rubric(User admin) {
        UUID actor = UUID.nameUUIDFromBytes(("hierarchy-demo-actor:" + admin.getId()).getBytes(StandardCharsets.UTF_8));
        Instant now = Instant.now();
        Rubric rubric = rubrics.saveAndFlush(Rubric.create(UUID.randomUUID(), RubricTenantIdentity.from(admin.getTenantId()),
                "Hierarchy Demo Scorecard", "Database, API documentation and code quality; each criterion has a maximum score of 10.", actor, now));
        RubricVersion version = RubricVersion.draft(UUID.randomUUID(), rubric, 1, actor, now);
        version.replaceDraft(rubric.getName(), rubric.getDescription(), List.of(
                new RubricVersion.CriterionValue("DATABASE", "Database Schema", "Correct entities and constraints", new BigDecimal("40"), BigDecimal.TEN, 0),
                new RubricVersion.CriterionValue("API_DOCS", "API Docs", "Clear request and response contracts", new BigDecimal("30"), BigDecimal.TEN, 1),
                new RubricVersion.CriterionValue("CODE_QUALITY", "Code Quality", "Readable implementation and useful checks", new BigDecimal("30"), BigDecimal.TEN, 2)), actor, now);
        version.publish(actor, now);
        return rubricVersions.saveAndFlush(version);
    }
}
